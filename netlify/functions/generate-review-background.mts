// ============================================================
// Never Sign Blind™ — AI Review Generator (Background)
// Triggered by submit-review and stripe-webhook.
// Runs Claude API on the uploaded PDF, stores structured JSON,
// emails Starr the draft with approve/edit buttons.
// Falls back to mock review if ANTHROPIC_API_KEY not set.
// ============================================================

import type { Context } from '@netlify/functions'
import { getReview, getPDF, updateReview, getPrompt } from './lib/blobs.mts'
import { getMockReview } from './lib/mock-review.mts'
import { sendEmail, emailDraftReady } from './lib/email.mts'
import type { ReviewDraft } from './lib/types.mts'

export default async (req: Request, context: Context) => {
  // Security: internal calls only
  const adminToken = Netlify.env.get('ADMIN_TOKEN') || 'dev-token'
  const internalToken = req.headers.get('x-internal-token')
  if (internalToken !== adminToken) {
    return // Background functions return nothing — just stop
  }

  let body: { reviewId?: string }
  try {
    body = await req.json()
  } catch {
    console.error('Invalid body in generate-review-background')
    return
  }

  const { reviewId } = body
  if (!reviewId) return

  // Load review
  const review = await getReview(reviewId)
  if (!review) {
    console.error(`Review ${reviewId} not found`)
    return
  }

  // Prevent duplicate generation
  if (['generated', 'approved', 'delivered'].includes(review.draft_status)) {
    console.log(`Review ${reviewId} already processed`)
    return
  }

  // Mark as generating
  await updateReview(reviewId, { draft_status: 'generating' })

  const anthropicKey = Netlify.env.get('ANTHROPIC_API_KEY')
  let draft: ReviewDraft

  if (!anthropicKey) {
    // TESTING MODE: use mock review
    console.log('⚠️ No ANTHROPIC_API_KEY — using mock review for', reviewId)
    await new Promise(r => setTimeout(r, 2000)) // Simulate processing time
    draft = getMockReview(reviewId)
  } else {
    // PRODUCTION MODE: call Claude API
    try {
      draft = await generateWithClaude(reviewId, anthropicKey)
    } catch (err) {
      console.error('Claude API failed for', reviewId, err)
      await updateReview(reviewId, {
        draft_status: 'error',
        internal_notes: `AI generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      })
      // Notify Starr of failure
      const notificationEmail = Netlify.env.get('NOTIFICATION_EMAIL') || 'thegiftedbystarr@gmail.com'
      await sendEmail({
        to: notificationEmail,
        subject: `⚠️ AI Review Failed — ${review.name} at ${review.company}`,
        html: `<p>AI review generation failed for review ID: ${reviewId}</p><p>Client: ${review.name} at ${review.company}</p><p>Please review manually and deliver.</p><p>Error: ${err instanceof Error ? err.message : 'Unknown error'}</p>`
      })
      return
    }
  }

  // Store draft in review record
  await updateReview(reviewId, {
    draft_status: 'generated',
    ai_draft: draft,
    ai_prompt_version: 'v1'
  })

  // Email Starr the draft with approve button
  const notificationEmail = Netlify.env.get('NOTIFICATION_EMAIL') || 'thegiftedbystarr@gmail.com'
  const updatedReview = await getReview(reviewId)
  if (!updatedReview) return

  try {
    await sendEmail({
      to: notificationEmail,
      subject: `✅ Review Draft Ready — ${review.name} at ${review.company} [${review.tier.toUpperCase()}]`,
      html: emailDraftReady(updatedReview, draft, adminToken)
    })
    console.log(`Draft ready email sent for review ${reviewId}`)
  } catch (err) {
    console.error('Failed to send draft ready email:', err)
  }
}

async function generateWithClaude(reviewId: string, apiKey: string): Promise<ReviewDraft> {
  // Load PDF
  const pdfBuffer = await getPDF(reviewId)
  if (!pdfBuffer) {
    throw new Error('PDF not found in storage')
  }

  // Convert to base64
  const base64PDF = Buffer.from(pdfBuffer).toString('base64')

  // Load system prompt
  const systemPrompt = await getPrompt()

  // Call Anthropic API
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64PDF
            }
          } as { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } },
          {
            type: 'text',
            text: 'Review this subcontract. Return ONLY the JSON object — no preamble, no markdown fences, no explanation outside the JSON schema provided in your instructions.'
          }
        ]
      }
    ]
  })

  // Extract text content
  const textBlock = message.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Claude response')
  }

  // Parse JSON — strip any accidental markdown fences
  const cleaned = textBlock.text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let draft: ReviewDraft
  try {
    draft = JSON.parse(cleaned)
  } catch {
    throw new Error(`Failed to parse Claude JSON response: ${cleaned.substring(0, 200)}`)
  }

  // Validate required fields
  if (!draft.score || !draft.cashtrap_scan || !draft.pushback_script) {
    throw new Error('Claude response missing required fields')
  }

  // Ensure prompt version and timestamp
  draft.prompt_version = 'v1'
  draft.generated_at = new Date().toISOString()

  return draft
}
