// ============================================================
// Never Sign Blind™ — Approve Review
// GET /api/approve-review?id={reviewId}&token={ADMIN_TOKEN}
// POST /api/approve-review (from admin dashboard with edits)
// Sends final review to buyer and marks delivered.
// ============================================================

import type { Config, Context } from '@netlify/functions'
import { getReview, updateReview, updateLeadStep } from './lib/blobs.mts'
import { sendEmail, emailFinalReview } from './lib/email.mts'
import type { ReviewDraft } from './lib/types.mts'

export default async (req: Request, context: Context) => {
  const adminToken = Netlify.env.get('ADMIN_TOKEN') || 'dev-token'
  const url = new URL(req.url)
  const reviewId = url.searchParams.get('id')
  const token = url.searchParams.get('token')

  // Auth check
  if (token !== adminToken) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!reviewId) {
    return new Response(JSON.stringify({ error: 'Missing review ID' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Load review
  const review = await getReview(reviewId)
  if (!review) {
    return new Response(JSON.stringify({ error: 'Review not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    })
  }

  if (!review.ai_draft) {
    return new Response(JSON.stringify({ error: 'No draft available to approve' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // For POST: allow edited draft to be submitted
  let draftToSend: ReviewDraft = review.ai_draft
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      if (body.edited_draft) {
        draftToSend = { ...review.ai_draft, ...body.edited_draft }
      }
    } catch {
      // Use original draft if no valid body
    }
  }

  // Send final review email to buyer
  try {
    await sendEmail({
      to: review.email,
      subject: `Your Never Sign Blind™ Review — ${review.company}`,
      html: emailFinalReview(review, draftToSend)
    })
  } catch (err) {
    console.error('Failed to send final review email:', err)
    return new Response(JSON.stringify({ error: 'Failed to send review email' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Mark as delivered
  await updateReview(reviewId, {
    draft_status: 'delivered',
    delivered: true,
    delivered_at: new Date().toISOString(),
    ai_draft: draftToSend
  })

  // Mark lead as converted
  try {
    await updateLeadStep(review.email, 4, true)
  } catch { /* Lead may not exist */ }

  // Return success — for GET requests (one-click from email) show a nice HTML page
  if (req.method === 'GET') {
    return new Response(`<!DOCTYPE html>
<html><head><title>Review Sent — Never Sign Blind™</title>
<style>body{font-family:sans-serif;background:#F4F7FA;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.box{background:#fff;padding:48px;max-width:480px;text-align:center;border-top:4px solid #0D9E9E;}
h1{color:#0F2044;} p{color:#374151;} .back{color:#0D9E9E;}</style>
</head><body>
<div class="box">
  <h1>✅ Review Delivered</h1>
  <p>The Never Sign Blind™ review has been sent to <strong>${review.name}</strong> at <strong>${review.email}</strong>.</p>
  <p>Review ID: <code>${reviewId}</code></p>
  <p><a href="/admin.html" class="back">← Back to Admin Dashboard</a></p>
</div>
</body></html>`, {
      status: 200, headers: { 'Content-Type': 'text/html' }
    })
  }

  return new Response(JSON.stringify({ success: true, reviewId, delivered_to: review.email }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  })
}

export const config: Config = {
  path: '/api/approve-review'
}
