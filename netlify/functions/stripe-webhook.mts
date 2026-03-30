// ============================================================
// Never Sign Blind™ — Stripe Webhook
// POST /api/stripe-webhook
// Verifies Stripe signature, marks review paid,
// triggers background AI generation if not yet started.
// ============================================================

import type { Config, Context } from '@netlify/functions'
import { getReview, updateReview } from './lib/blobs.mts'
import { sendEmail, emailPaymentConfirmed } from './lib/email.mts'

const TIER_LABEL_MAP: Record<string, string> = {
  quick: 'Quick Clause Check',
  full: 'Never Sign Blind™ Review',
  rush: 'Rush Review'
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const stripeSecret = Netlify.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Netlify.env.get('STRIPE_WEBHOOK_SECRET')
  const adminToken = Netlify.env.get('ADMIN_TOKEN') || 'dev-token'

  // Get raw body for signature verification
  const rawBody = await req.text()

  // Verify Stripe signature if webhook secret is configured
  if (webhookSecret && stripeSecret) {
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      console.error('Missing stripe-signature header')
      return new Response('Missing signature', { status: 400 })
    }

    // Dynamically import Stripe only when needed
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeSecret)

    let event: ReturnType<typeof stripe.webhooks.constructEvent>
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    } catch (err) {
      console.error('Stripe signature verification failed:', err)
      return new Response('Invalid signature', { status: 400 })
    }

    // Only handle successful checkouts
    if (event.type !== 'checkout.session.completed') {
      return new Response('OK', { status: 200 })
    }

    const session = event.data.object as {
      id: string
      metadata?: { reviewId?: string; tier?: string }
      customer_details?: { email?: string; name?: string }
    }

    const reviewId = session.metadata?.reviewId
    if (!reviewId) {
      console.error('No reviewId in Stripe session metadata')
      return new Response('OK', { status: 200 }) // Don't retry — not our session
    }

    await handlePaymentConfirmed(reviewId, session.id, adminToken, context)

  } else {
    // Testing mode: accept raw JSON without signature verification
    console.log('⚠️ TESTING MODE: Stripe signature verification bypassed')
    let body: { reviewId?: string; sessionId?: string }
    try {
      body = JSON.parse(rawBody)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
    }

    if (body.reviewId) {
      await handlePaymentConfirmed(body.reviewId, body.sessionId || 'test-session', adminToken, context)
    }
  }

  return new Response('OK', { status: 200 })
}

async function handlePaymentConfirmed(
  reviewId: string,
  sessionId: string,
  adminToken: string,
  context: Context
): Promise<void> {
  const review = await getReview(reviewId)
  if (!review) {
    console.error(`Review ${reviewId} not found for payment confirmation`)
    return
  }

  // Mark as paid
  await updateReview(reviewId, {
    paid: true,
    paid_at: new Date().toISOString(),
    stripe_session_id: sessionId,
    draft_status: review.draft_status === 'pending' ? 'pending' : review.draft_status
  })

  // Send buyer confirmation
  try {
    await sendEmail({
      to: review.email,
      subject: 'Payment confirmed — Never Sign Blind™ Review in progress',
      html: emailPaymentConfirmed(
        review.name,
        TIER_LABEL_MAP[review.tier] || review.tier,
        review.deadline
      )
    })
  } catch (err) {
    console.error('Failed to send payment confirmation:', err)
  }

  // Trigger AI generation if file exists and not already generating
  if (review.file_key && review.draft_status === 'pending') {
    const baseUrl = context.site?.url || 'https://never-sign-blind.netlify.app'
    fetch(`${baseUrl}/.netlify/functions/generate-review-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': adminToken },
      body: JSON.stringify({ reviewId })
    }).catch(err => console.error('Failed to trigger AI generation:', err))
  }
}

export const config: Config = {
  path: '/api/stripe-webhook'
}
