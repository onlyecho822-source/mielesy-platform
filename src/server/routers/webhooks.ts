// src/server/routers/webhooks.ts
// Stripe webhook handler — all 8 required events
// G5 FIX: credit purchases only, no P2P transfers

import Stripe from "stripe"
import { db } from "../db"
import { applyTrustEvent } from "../trust/engine"
import { purchaseCredits } from "../credits/ledger"
import { TrustEventType } from "@prisma/client"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
})

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string
): Promise<{ received: boolean }> {
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${err}`)
  }

  // Idempotency — skip already-processed events
  const existing = await db.stripeEvent.findUnique({ where: { id: event.id } })
  if (existing?.processed) return { received: true }

  // Upsert event record
  await db.stripeEvent.upsert({
    where: { id: event.id },
    create: { id: event.id, type: event.type, payload: event as object },
    update: {},
  })

  try {
    await processEvent(event)
    await db.stripeEvent.update({
      where: { id: event.id },
      data: { processed: true, processedAt: new Date() },
    })
  } catch (err) {
    await db.stripeEvent.update({
      where: { id: event.id },
      data: { error: String(err) },
    })
    throw err
  }

  return { received: true }
}

async function processEvent(event: Stripe.Event) {
  switch (event.type) {
    // ── 1. Subscription created ──────────────────────────────────────────────
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription
      const user = await getUserByStripeCustomer(sub.customer as string)
      if (!user) break
      const tier = priceToTier(sub.items.data[0]?.price.id)
      await db.user.update({
        where: { id: user.id },
        data: {
          membershipTier: tier,
          stripeSubscriptionId: sub.id,
          membershipExpiresAt: new Date(sub.current_period_end * 1000),
          status: "ACTIVE",
        },
      })
      break
    }

    // ── 2. Subscription updated ──────────────────────────────────────────────
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      const user = await getUserByStripeCustomer(sub.customer as string)
      if (!user) break
      const tier = priceToTier(sub.items.data[0]?.price.id)
      await db.user.update({
        where: { id: user.id },
        data: {
          membershipTier: tier,
          membershipExpiresAt: new Date(sub.current_period_end * 1000),
        },
      })
      break
    }

    // ── 3. Subscription deleted ──────────────────────────────────────────────
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      const user = await getUserByStripeCustomer(sub.customer as string)
      if (!user) break
      await db.user.update({
        where: { id: user.id },
        data: { membershipTier: "EXPLORER", membershipExpiresAt: null },
      })
      break
    }

    // ── 4. Invoice payment succeeded ─────────────────────────────────────────
    case "invoice.payment_succeeded": {
      const inv = event.data.object as Stripe.Invoice
      const user = await getUserByStripeCustomer(inv.customer as string)
      if (!user) break
      // Subscription renewal — extend expiry already handled by subscription.updated
      console.log(`[Stripe] Invoice paid for user ${user.id}: $${(inv.amount_paid / 100).toFixed(2)}`)
      break
    }

    // ── 5. Invoice payment failed ────────────────────────────────────────────
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice
      const user = await getUserByStripeCustomer(inv.customer as string)
      if (!user) break
      // Could downgrade to EXPLORER after grace period — log for now
      console.warn(`[Stripe] Payment failed for user ${user.id}`)
      break
    }

    // ── 6. Payment intent succeeded (credit purchase) ────────────────────────
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent
      const credits = pi.metadata?.credits ? parseInt(pi.metadata.credits) : 0
      const userId = pi.metadata?.userId
      if (userId && credits > 0) {
        await purchaseCredits(userId, credits, pi.id)
      }
      break
    }

    // ── 7. Payment intent failed ─────────────────────────────────────────────
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent
      console.warn(`[Stripe] Payment intent failed: ${pi.id}`)
      break
    }

    // ── 8. Customer updated ──────────────────────────────────────────────────
    case "customer.updated": {
      const cus = event.data.object as Stripe.Customer
      const user = await getUserByStripeCustomer(cus.id)
      if (!user || typeof cus.email !== "string") break
      if (cus.email !== user.email) {
        await db.user.update({
          where: { id: user.id },
          data: { email: cus.email },
        })
      }
      break
    }
  }
}

async function getUserByStripeCustomer(customerId: string) {
  return db.user.findFirst({ where: { stripeCustomerId: customerId } })
}

function priceToTier(priceId?: string): "EXPLORER" | "MEMBER" | "VIP" {
  const map: Record<string, "EXPLORER" | "MEMBER" | "VIP"> = {
    [process.env.STRIPE_PRICE_MEMBER ?? ""]: "MEMBER",
    [process.env.STRIPE_PRICE_VIP ?? ""]:    "VIP",
  }
  return priceId ? (map[priceId] ?? "EXPLORER") : "EXPLORER"
}
