// ============================================================
// Never Sign Blind™ — Submit Review
// POST /api/submit-review (multipart/form-data)
// Stores PDF, creates review record, alerts Starr,
// triggers background AI generation.
// ============================================================

import type { Config, Context } from '@netlify/functions'
import { saveReview, savePDF, updateLeadStep } from './lib/blobs.mts'
import { sendEmail, emailNewReviewAlert, emailPaymentConfirmed } from './lib/email.mts'
import type { Review, ReviewTier, TIER_PRICES } from './lib/types.mts'

const TIER_PRICE_MAP: Record<ReviewTier, number> = { quick: 99, full: 299, rush: 499 }
const TIER_LABEL_MAP: Record<ReviewTier, string> = {
  quick: 'Quick Clause Check',
  full: 'Never Sign Blind™ Review',
  rush: 'Rush Review'
}
const MAX_FILE_SIZE = 6 * 1024 * 1024 // 6MB — Netlify function body limit

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return new Response(JSON.stringify({ error: 'Could not parse form data' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Extract fields
  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const company = (formData.get('company') as string)?.trim() || ''
  const phone = (formData.get('phone') as string)?.trim() || ''
  const tier = (formData.get('tier') as ReviewTier) || 'full'
  const deadline = (formData.get('deadline') as string)?.trim()
  const context_text = (formData.get('context') as string)?.trim() || ''
  const stripe_session_id = (formData.get('stripe_session_id') as string)?.trim() || ''
  const file = formData.get('file') as File | null

  // Validate required fields
  const errors: string[] = []
  if (!name) errors.push('Name is required')
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email is required')
  if (!deadline) errors.push('Signing deadline is required')
  if (!['quick', 'full', 'rush'].includes(tier)) errors.push('Invalid tier')

  if (errors.length > 0) {
    return new Response(JSON.stringify({ error: errors.join(', ') }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Validate file if provided
  let fileBuffer: ArrayBuffer | null = null
  let fileKey = ''
  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: 'File too large. Maximum size is 6MB. Compress the PDF and try again.' }), {
        status: 413, headers: { 'Content-Type': 'application/json' }
      })
    }
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png']
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|jpg|jpeg|png)$/i)) {
      return new Response(JSON.stringify({ error: 'File must be PDF, Word document, or image' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      })
    }
    fileBuffer = await file.arrayBuffer()
  }

  // Generate review ID
  const reviewId = crypto.randomUUID()
  fileKey = fileBuffer ? reviewId : ''

  // Store PDF in blob store
  if (fileBuffer) {
    await savePDF(reviewId, fileBuffer)
  }

  // Determine if paid (Stripe session already confirmed)
  // Full payment confirmation comes via stripe-webhook
  const isPaid = !!stripe_session_id

  // Build review record
  const review: Review = {
    id: reviewId,
    name,
    email,
    company,
    phone,
    tier: tier as ReviewTier,
    price: TIER_PRICE_MAP[tier as ReviewTier],
    deadline,
    context: context_text,
    stripe_session_id,
    paid: isPaid,
    paid_at: isPaid ? new Date().toISOString() : undefined,
    file_key: fileKey,
    draft_status: 'pending',
    delivered: false,
    internal_notes: '',
    created_at: new Date().toISOString()
  }

  // Save review record
  await saveReview(review)

  // Mark lead as converted if they were in the sequence
  try {
    await updateLeadStep(email, 4, true)
  } catch {
    // Lead may not exist — that's fine
  }

  const adminToken = Netlify.env.get('ADMIN_TOKEN') || 'dev-token'
  const notificationEmail = Netlify.env.get('NOTIFICATION_EMAIL') || 'thegiftedbystarr@gmail.com'

  // Alert Starr about new review
  try {
    await sendEmail({
      to: notificationEmail,
      subject: `🔔 New Review — ${name} at ${company} [${tier.toUpperCase()}]`,
      html: emailNewReviewAlert({ ...review }, adminToken)
    })
  } catch (err) {
    console.error('Failed to send admin alert:', err)
  }

  // Send buyer payment confirmation (if paid)
  if (isPaid) {
    try {
      await sendEmail({
        to: email,
        subject: 'Payment confirmed — Never Sign Blind™ Review in progress',
        html: emailPaymentConfirmed(name, TIER_LABEL_MAP[tier as ReviewTier], deadline)
      })
    } catch (err) {
      console.error('Failed to send buyer confirmation:', err)
    }
  }

  // Trigger background AI review generation
  // Fire-and-forget: call the background function via internal fetch
  if (fileKey) {
    const baseUrl = context.site?.url || 'https://never-sign-blind.netlify.app'
    fetch(`${baseUrl}/.netlify/functions/generate-review-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': adminToken },
      body: JSON.stringify({ reviewId })
    }).catch(err => console.error('Background trigger failed:', err))
  }

  return new Response(JSON.stringify({ success: true, reviewId }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  })
}

export const config: Config = {
  path: '/api/submit-review'
}
