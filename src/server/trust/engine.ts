// src/server/trust/engine.ts
// CORRECTED against Master Blueprint v2.0
// G3 FIX: trust_score event-sourced — delta values from blueprint §3.2

import { db } from "../db"
import { TrustEventType, NotificationType } from "@prisma/client"
import { notify } from "../sonic/notify"

const TRUST_DELTAS: Record<TrustEventType, number> = {
  IDENTITY_VERIFIED:   20,  // blueprint: +20
  PHONE_VERIFIED:      10,  // blueprint: +10
  PROFILE_COMPLETED:    5,  // blueprint: (implied)
  EVENT_ATTENDED:       5,  // blueprint: +5, capped +25/year
  GIFT_SENT:            2,  // blueprint: +2 per UNIQUE recipient, capped +10/year (was +3, fixed)
  REPORT_RECEIVED:    -20,  // blueprint: -20 (was -15, fixed)
  NO_SHOW_EVENT:      -10,  // blueprint: -10 (was -8, fixed)
  WARNING_ISSUED:     -10,  // blueprint: (implied admin action)
  CHARGEBACK_FILED:   -25,  // blueprint: -25 — new, added from blueprint §3.2
  INACTIVITY_90_DAYS:  -5,  // blueprint: -5 (new — scheduled job)
  MANUAL_ADJUSTMENT:    0,  // delta provided explicitly
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
