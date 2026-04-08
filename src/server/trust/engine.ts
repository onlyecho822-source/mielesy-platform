// src/server/trust/engine.ts
// G3 FIX: Trust score calculation with full event sourcing

import { db } from "../db"
import { TrustEventType, NotificationType } from "@prisma/client"
import { notify } from "../sonic/notify"

const TRUST_DELTAS: Record<TrustEventType, number> = {
  IDENTITY_VERIFIED:  20,
  PHONE_VERIFIED:     10,
  PROFILE_COMPLETED:  5,
  EVENT_ATTENDED:     5,
  GIFT_SENT:          3,
  REPORT_RECEIVED:   -15,
  NO_SHOW_EVENT:     -8,
  WARNING_ISSUED:    -10,
  MANUAL_ADJUSTMENT:  0, // delta provided explicitly
}

export function scoreToBadge(score: number): string {
  if (score >= 80) return "verified"
  if (score >= 60) return "trusted"
  if (score >= 30) return "standard"
  return "restricted"
}

export async function applyTrustEvent(
  userId: string,
  type: TrustEventType,
  options?: {
    delta?: number    // override for MANUAL_ADJUSTMENT
    reason?: string
    refId?: string
    createdBy?: string
  }
) {
  const delta = options?.delta ?? TRUST_DELTAS[type]

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
  const scoreBefore = user.trustScore
  const scoreAfter = Math.min(100, Math.max(0, scoreBefore + delta))
  const badge = scoreToBadge(scoreAfter)

  await db.$transaction([
    db.trustEvent.create({
      data: {
        userId,
        type,
        delta,
        scoreBefore,
        scoreAfter,
        reason: options?.reason,
        refId: options?.refId,
        createdBy: options?.createdBy,
      },
    }),
    db.user.update({
      where: { id: userId },
      data: { trustScore: scoreAfter, trustBadge: badge },
    }),
  ])

  // Notify user if badge changed
  if (scoreToBadge(scoreBefore) !== badge) {
    await notify(userId, NotificationType.TRUST_SCORE_CHANGE, {
      badge,
      refId: options?.refId,
    })
  }

  return { scoreBefore, scoreAfter, badge }
}

export async function getTrustHistory(userId: string) {
  return db.trustEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}
