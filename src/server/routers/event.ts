// src/server/routers/event.ts
import { z } from "zod"
import { router, protectedProcedure } from "../trpc"
import { db } from "../db"
import { applyTrustEvent } from "../trust/engine"
import { TrustEventType } from "@prisma/client"

export const eventRouter = router({
  list: protectedProcedure
    .input(z.object({ laneId: z.string().optional(), page: z.number().default(0) }))
    .query(({ ctx, input }) =>
      db.event.findMany({
        where: {
          status: "PUBLISHED",
          startsAt: { gte: new Date() },
          ...(input.laneId ? { laneId: input.laneId } : {}),
        },
        orderBy: { startsAt: "asc" },
        skip: input.page * 20,
        take: 20,
        include: {
          _count: { select: { tickets: true } },
          lane: { select: { name: true, displayName: true } },
        },
      })
    ),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) =>
      db.event.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          creator: { select: { id: true, displayName: true, primaryPhotoUrl: true } },
          _count: { select: { tickets: true } },
        },
      })
    ),

  purchase: protectedProcedure
    .input(z.object({ eventId: z.string(), stripePaymentId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const event = await db.event.findUniqueOrThrow({ where: { id: input.eventId } })
      const user = await db.user.findUniqueOrThrow({ where: { id: ctx.userId } })

      // Tier and trust gate
      const tierOrder = ["EXPLORER", "MEMBER", "VIP"]
      if (tierOrder.indexOf(user.membershipTier) < tierOrder.indexOf(event.minTier)) {
        throw new Error(`Event requires ${event.minTier} membership`)
      }
      if (user.trustScore < event.minTrust) {
        throw new Error(`Event requires trust score ≥ ${event.minTrust}`)
      }

      const ticket = await db.ticket.create({
        data: {
          userId: ctx.userId,
          eventId: input.eventId,
          status: event.ticketPrice === 0 ? "PAID" : "RESERVED",
          stripePaymentId: input.stripePaymentId,
        },
      })
      return ticket
    }),

  markAttended: protectedProcedure
    .input(z.object({ ticketId: z.string(), userId: z.string() }))
    .mutation(async ({ input }) => {
      await db.ticket.update({
        where: { id: input.ticketId },
        data: { status: "ATTENDED", attendedAt: new Date() },
      })
      await applyTrustEvent(input.userId, TrustEventType.EVENT_ATTENDED, {
        refId: input.ticketId,
      })
    }),
})

// ─── Credit router ────────────────────────────────────────────────────────────
import { getCreditHistory } from "../credits/ledger"

export const creditRouter = router({
  balance: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { creditBalance: true },
    })
    return { balance: user.creditBalance }
  }),

  history: protectedProcedure.query(({ ctx }) => getCreditHistory(ctx.userId)),
})

// ─── Notification router ──────────────────────────────────────────────────────
import { getUnread, markRead } from "../sonic/notify"

export const notificationRouter = router({
  unread: protectedProcedure.query(({ ctx }) => getUnread(ctx.userId)),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => markRead(input.id, ctx.userId)),
})

// ─── Admin router ─────────────────────────────────────────────────────────────
import { applyTrustEvent as _applyTrust } from "../trust/engine"

export const adminRouter = router({
  adjustTrust: protectedProcedure
    .input(z.object({
      userId: z.string(),
      delta:  z.number(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // TODO: add admin role check
      return _applyTrust(ctx.userId, TrustEventType.MANUAL_ADJUSTMENT, {
        delta:     input.delta,
        reason:    input.reason,
        createdBy: ctx.userId,
      })
    }),

  resolveReport: protectedProcedure
    .input(z.object({
      reportId:  z.string(),
      resolution: z.string(),
      penalize:  z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const report = await db.report.update({
        where: { id: input.reportId },
        data: {
          resolved: true,
          resolution: input.resolution,
          resolvedBy: ctx.userId,
          resolvedAt: new Date(),
        },
      })
      if (input.penalize) {
        await _applyTrust(report.reportedId, TrustEventType.REPORT_RECEIVED, {
          reason: input.resolution,
          refId:  input.reportId,
          createdBy: ctx.userId,
        })
      }
      return report
    }),
})
