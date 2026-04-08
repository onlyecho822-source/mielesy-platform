// src/server/credits/ledger.ts
// G5 FIX: Closed-loop credit system — no real P2P Stripe transfers
// Credits: purchased from platform → sent to members → redeemed for services
// Legal basis: closed-loop prepaid system (FinCEN MSB exempt)

import { db } from "../db"
import { CreditTransactionType } from "@prisma/client"

export class InsufficientCreditsError extends Error {
  constructor(available: number, required: number) {
    super(`Insufficient credits: have ${available}, need ${required}`)
    this.name = "InsufficientCreditsError"
  }
}

export async function purchaseCredits(
  userId: string,
  amount: number,
  stripePaymentIntentId: string
) {
  return _applyCredit(userId, CreditTransactionType.PURCHASE, amount, {
    description: `Purchased ${amount} credits`,
    refId: stripePaymentIntentId,
  })
}

export async function sendGiftCredits(
  senderId: string,
  recipientId: string,
  amount: number,
  giftId: string
) {
  // Atomic: debit sender, credit recipient
  const sender = await db.user.findUniqueOrThrow({ where: { id: senderId } })
  if (sender.creditBalance < amount) {
    throw new InsufficientCreditsError(sender.creditBalance, amount)
  }

  await db.$transaction(async (tx) => {
    // Debit sender
    await tx.creditTransaction.create({
      data: {
        userId: senderId,
        type: CreditTransactionType.GIFT_SENT,
        amount: -amount,
        balanceBefore: sender.creditBalance,
        balanceAfter: sender.creditBalance - amount,
        description: `Gift sent (${amount} credits)`,
        refId: giftId,
      },
    })
    await tx.user.update({
      where: { id: senderId },
      data: { creditBalance: { decrement: amount } },
    })

    // Credit recipient
    const recipient = await tx.user.findUniqueOrThrow({ where: { id: recipientId } })
    await tx.creditTransaction.create({
      data: {
        userId: recipientId,
        type: CreditTransactionType.GIFT_RECEIVED,
        amount: amount,
        balanceBefore: recipient.creditBalance,
        balanceAfter: recipient.creditBalance + amount,
        description: `Gift received (${amount} credits)`,
        refId: giftId,
      },
    })
    await tx.user.update({
      where: { id: recipientId },
      data: { creditBalance: { increment: amount } },
    })
  })
}

export async function redeemCredits(
  userId: string,
  amount: number,
  description: string,
  refId?: string
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
  if (user.creditBalance < amount) {
    throw new InsufficientCreditsError(user.creditBalance, amount)
  }
  return _applyCredit(userId, CreditTransactionType.REDEMPTION, -amount, {
    description,
    refId,
  })
}

async function _applyCredit(
  userId: string,
  type: CreditTransactionType,
  amount: number,
  opts?: { description?: string; refId?: string }
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
  const balanceBefore = user.creditBalance
  const balanceAfter = balanceBefore + amount

  if (balanceAfter < 0) {
    throw new InsufficientCreditsError(balanceBefore, Math.abs(amount))
  }

  await db.$transaction([
    db.creditTransaction.create({
      data: {
        userId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        description: opts?.description,
        refId: opts?.refId,
      },
    }),
    db.user.update({
      where: { id: userId },
      data: { creditBalance: balanceAfter },
    }),
  ])

  return { balanceBefore, balanceAfter }
}

export async function getCreditHistory(userId: string) {
  return db.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}
