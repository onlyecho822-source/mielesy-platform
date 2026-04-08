// src/server/lanes/manager.ts
// G4 FIX: Many-to-many lane membership with anti-abuse cooldown

import { db } from "../db"
import { LaneName, LaneMemberStatus } from "@prisma/client"

const COOLDOWN_HOURS = 48

export class LaneCooldownError extends Error {
  constructor(until: Date) {
    super(`Lane cooldown active until ${until.toISOString()}`)
    this.name = "LaneCooldownError"
  }
}

export async function joinLane(userId: string, laneId: string) {
  const lane = await db.lane.findUniqueOrThrow({ where: { id: laneId } })
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })

  // Check tier and trust requirements
  const tierOrder = ["EXPLORER", "MEMBER", "VIP"]
  if (tierOrder.indexOf(user.membershipTier) < tierOrder.indexOf(lane.minTier)) {
    throw new Error(`Lane requires ${lane.minTier} membership`)
  }
  if (user.trustScore < lane.minTrust) {
    throw new Error(`Lane requires trust score ≥ ${lane.minTrust}`)
  }

  // Check for existing membership
  const existing = await db.userLane.findUnique({
    where: { userId_laneId: { userId, laneId } },
  })

  if (existing) {
    if (existing.status === LaneMemberStatus.ACTIVE) {
      throw new Error("Already a member of this lane")
    }
    // Check cooldown
    if (existing.cooldownUntil && existing.cooldownUntil > new Date()) {
      throw new LaneCooldownError(existing.cooldownUntil)
    }
    // Rejoin
    return db.userLane.update({
      where: { userId_laneId: { userId, laneId } },
      data: { status: LaneMemberStatus.ACTIVE, leftAt: null, cooldownUntil: null },
    })
  }

  return db.userLane.create({
    data: { userId, laneId, status: LaneMemberStatus.ACTIVE },
  })
}

export async function leaveLane(userId: string, laneId: string) {
  const cooldownUntil = new Date()
  cooldownUntil.setHours(cooldownUntil.getHours() + COOLDOWN_HOURS)

  return db.userLane.update({
    where: { userId_laneId: { userId, laneId } },
    data: {
      status: LaneMemberStatus.LEFT,
      leftAt: new Date(),
      cooldownUntil,
    },
  })
}

export async function getUserLanes(userId: string) {
  return db.userLane.findMany({
    where: { userId, status: LaneMemberStatus.ACTIVE },
    include: { lane: true },
  })
}

export async function getLaneMembers(laneId: string, page = 0, limit = 20) {
  return db.userLane.findMany({
    where: { laneId, status: LaneMemberStatus.ACTIVE },
    include: {
      user: {
        select: {
          id: true, displayName: true, primaryPhotoUrl: true,
          location: true, age: true, trustBadge: true, membershipTier: true,
        },
      },
    },
    orderBy: { joinedAt: "desc" },
    skip: page * limit,
    take: limit,
  })
}

export async function canInteract(
  fromUserId: string,
  toUserId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const [fromLanes, toLanes] = await Promise.all([
    getUserLanes(fromUserId),
    getUserLanes(toUserId),
  ])

  const sharedLanes = fromLanes.filter((fl) =>
    toLanes.some((tl) => tl.laneId === fl.laneId)
  )

  if (sharedLanes.length === 0) {
    return { allowed: false, reason: "No shared lanes" }
  }
  return { allowed: true }
}
