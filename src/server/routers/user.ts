// src/server/routers/user.ts

import { z } from "zod"
import { router, protectedProcedure, publicProcedure } from "../trpc"
import { db } from "../db"
import { applyTrustEvent } from "../trust/engine"
import { TrustEventType } from "@prisma/client"

export const userRouter = router({
  // Get current user profile
  me: protectedProcedure.query(async ({ ctx }) => {
    return db.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      include: {
        lanes: { include: { lane: true }, where: { status: "ACTIVE" } },
      },
    })
  }),

  // Update profile
  updateProfile: protectedProcedure
    .input(z.object({
      displayName: z.string().min(2).max(50).optional(),
      bio:         z.string().max(500).optional(),
      location:    z.string().max(100).optional(),
      age:         z.number().int().min(18).max(99).optional(),
      language:    z.enum(["en", "es"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await db.user.update({
        where: { id: ctx.userId },
        data: input,
      })

      // G3: Check if profile is now complete
      const isComplete = Boolean(
        user.displayName && user.bio && user.location && user.age
      )
      if (isComplete && !user.isProfileComplete) {
        await db.user.update({
          where: { id: ctx.userId },
          data: { isProfileComplete: true },
        })
        await applyTrustEvent(ctx.userId, TrustEventType.PROFILE_COMPLETED)
      }
      return user
    }),

  // Get public profile (trust badge shown, raw score hidden)
  getProfile: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return db.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: {
          id: true, displayName: true, primaryPhotoUrl: true,
          location: true, age: true, trustBadge: true,
          membershipTier: true, bio: true,
          lanes: {
            where: { status: "ACTIVE" },
            include: { lane: { select: { name: true, displayName: true, displayNameEs: true } } },
          },
        },
      })
    }),

  // Verify identity complete (called after Clerk verification)
  onIdentityVerified: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await db.user.findUniqueOrThrow({ where: { id: ctx.userId } })
    if (!user.isIdentityVerified) {
      await db.user.update({
        where: { id: ctx.userId },
        data: { isIdentityVerified: true, status: "ACTIVE" },
      })
      await applyTrustEvent(ctx.userId, TrustEventType.IDENTITY_VERIFIED)
    }
    return { ok: true }
  }),

  // Verify phone complete
  onPhoneVerified: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await db.user.findUniqueOrThrow({ where: { id: ctx.userId } })
    if (!user.isPhoneVerified) {
      await db.user.update({ where: { id: ctx.userId }, data: { isPhoneVerified: true } })
      await applyTrustEvent(ctx.userId, TrustEventType.PHONE_VERIFIED)
    }
    return { ok: true }
  }),
})
