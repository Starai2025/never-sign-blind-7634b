// ============================================================
// Never Sign Blind™ — Admin API
// GET/POST /api/admin
// Powers the admin dashboard — reviews, leads, outreach, config.
// Auth: Bearer token or ?token= query param
// ============================================================

import type { Config, Context } from '@netlify/functions'
import {
  listReviews, getReview, updateReview,
  listLeads, listOutreach, saveOutreach,
  savePrompt, getPrompt, getClauseWeights
} from './lib/blobs.mts'
import type { OutreachContact } from './lib/types.mts'

export default async (req: Request, context: Context) => {
  // Auth
  const adminToken = Netlify.env.get('ADMIN_TOKEN') || 'dev-token'
  const url = new URL(req.url)
  const tokenParam = url.searchParams.get('token')
  const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
  const token = tokenParam || authHeader

  if (token !== adminToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    })
  }

  const view = url.searchParams.get('view')
  const action = url.searchParams.get('action')

  // ── GET requests ──────────────────────────────────────────

  if (req.method === 'GET') {

    if (view === 'reviews') {
      const reviews = await listReviews()
      return json(reviews)
    }

    if (view === 'review') {
      const id = url.searchParams.get('id')
      if (!id) return json({ error: 'Missing id' }, 400)
      const review = await getReview(id)
      if (!review) return json({ error: 'Not found' }, 404)
      return json(review)
    }

    if (view === 'leads') {
      const leads = await listLeads()
      return json(leads)
    }

    if (view === 'outreach') {
      const contacts = await listOutreach()
      return json(contacts)
    }

    if (view === 'config') {
      const [prompt, weights] = await Promise.all([getPrompt(), getClauseWeights()])
      return json({ prompt, weights })
    }

    if (view === 'stats') {
      const [reviews, leads] = await Promise.all([listReviews(), listLeads()])
      const stats = {
        total_reviews: reviews.length,
        paid_reviews: reviews.filter(r => r.paid).length,
        delivered_reviews: reviews.filter(r => r.delivered).length,
        pending_reviews: reviews.filter(r => r.paid && !r.delivered).length,
        total_leads: leads.length,
        converted_leads: leads.filter(l => l.converted).length,
        revenue: reviews.filter(r => r.paid).reduce((sum, r) => sum + r.price, 0),
        conversion_rate: leads.length > 0
          ? Math.round((leads.filter(l => l.converted).length / leads.length) * 100)
          : 0
      }
      return json(stats)
    }

    return json({ error: 'Unknown view' }, 400)
  }

  // ── POST requests ─────────────────────────────────────────

  if (req.method === 'POST') {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    if (action === 'update-review') {
      const { id, internal_notes, ai_draft } = body as {
        id?: string, internal_notes?: string, ai_draft?: unknown
      }
      if (!id) return json({ error: 'Missing id' }, 400)
      const updates: Record<string, unknown> = {}
      if (internal_notes !== undefined) updates.internal_notes = internal_notes
      if (ai_draft !== undefined) updates.ai_draft = ai_draft
      await updateReview(id as string, updates)
      return json({ success: true })
    }

    if (action === 'save-outreach') {
      const contact = body as Partial<OutreachContact>
      if (!contact.company && !contact.contact_name) {
        return json({ error: 'Company or contact name required' }, 400)
      }
      const record: OutreachContact = {
        id: contact.id || crypto.randomUUID(),
        company: contact.company || '',
        contact_name: contact.contact_name || '',
        title: contact.title || '',
        email: contact.email || '',
        linkedin: contact.linkedin || '',
        first_outreach_date: contact.first_outreach_date || new Date().toISOString().split('T')[0],
        channel: contact.channel || '',
        pain_angle: contact.pain_angle || '',
        reply_status: contact.reply_status || 'none',
        sample_sent: contact.sample_sent || false,
        review_sold: contact.review_sold || false,
        testimonial_requested: contact.testimonial_requested || false,
        testimonial_received: contact.testimonial_received || false,
        notes: contact.notes || '',
        created_at: contact.created_at || new Date().toISOString()
      }
      await saveOutreach(record)
      return json({ success: true, id: record.id })
    }

    if (action === 'update-prompt') {
      const { prompt_text } = body as { prompt_text?: string }
      if (!prompt_text) return json({ error: 'Missing prompt_text' }, 400)
      await savePrompt(prompt_text)
      return json({ success: true })
    }

    return json({ error: 'Unknown action' }, 400)
  }

  return new Response('Method not allowed', { status: 405 })
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export const config: Config = {
  path: '/api/admin'
}
