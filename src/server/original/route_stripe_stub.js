import Stripe from 'stripe';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';

export async function POST(req) {
  const body = await req.text();
  const signature = headers().get('Stripe-Signature');

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  const session = event.data.object;

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      // Fulfill the purchase
      console.log('PaymentIntent was successful!');
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await db.user.update({
        where: {
          stripeCustomerId: session.customer,
        },
        data: {
          // Update user tier based on subscription status
        },
      });
      break;
    case 'charge.dispute.created':
        // Handle dispute
        console.log('Dispute created!');
        break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new NextResponse(null, { status: 200 });
}
