// src/server/routers/gift.ts
// G5 FIX: credit-only gifting, no real money transfer

import { z } from "zod"
import { router, protectedProcedure } from "../trpc"
import { db } from "../db"
import { sendGiftCredits } from "../credits/ledger"
import { applyTrustEvent } from "../trust/engine"
import { notify } from "../sonic/notify"
import { TrustEventType, NotificationType } from "@prisma/client"

const GIFT_EXPIRY_DAYS = 30

export const giftRouter = router({
  send: protectedProcedure
    .input(z.object({
      recipientId:  z.string(),
      creditAmount: z.number().int().min(1).max(500),
      message:      z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + GIFT_EXPIRY_DAYS)

      const gift = await db.gift.create({
        data: {
          senderId:    ctx.userId,
          recipientId: input.recipientId,
          creditAmount: input.creditAmount,
          message:     input.message,
          expiresAt,
        },
      })

      // Transfer credits (atomic, G5 compliant)
      await sendGiftCredits(ctx.userId, input.recipientId, input.creditAmount, gift.id)

      // Mark delivered
      await db.gift.update({
        where: { id: gift.id },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      })

      // Trust event for sender
      await applyTrustEvent(ctx.userId, TrustEventType.GIFT_SENT, { refId: gift.id })

      // Notify recipient
      const sender = await db.user.findUniqueOrThrow({
        where: { id: ctx.userId },
        select: { displayName: true },
      })
      await notify(input.recipientId, NotificationType.GIFT_RECEIVED, {
        giftAmount: input.creditAmount,
        senderName: sender.displayName,
        refId: gift.id,
      })

      return gift
    }),

  inbox: protectedProcedure.query(({ ctx }) =>
    db.gift.findMany({
      where: { recipientId: ctx.userId },
      include: { sender: { select: { id: true, displayName: true, primaryPhotoUrl: true } } },
      orderBy: { sentAt: "desc" },
    })
  ),

  sent: protectedProcedure.query(({ ctx }) =>
    db.gift.findMany({
      where: { senderId: ctx.userId },
      include: { recipient: { select: { id: true, displayName: true, primaryPhotoUrl: true } } },
      orderBy: { sentAt: "desc" },
    })
  ),
})
