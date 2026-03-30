// ============================================================
// Never Sign Blind™ — Capture Lead
// POST /api/capture-lead
// Saves checklist opt-in and sends Email 1 immediately.
// ============================================================

import type { Config, Context } from '@netlify/functions'
import { saveLead, getLead } from './lib/blobs.mts'
import { sendEmail, emailChecklist } from './lib/email.mts'
import type { Lead } from './lib/types.mts'

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: { name?: string; email?: string; company?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const { name, email, company } = body

  // Validate required fields
  if (!name?.trim() || !email?.trim()) {
    return new Response(JSON.stringify({ error: 'Name and email are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email format' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Idempotency: already subscribed — silently succeed
  const existing = await getLead(normalizedEmail)
  if (existing) {
    return new Response(JSON.stringify({ success: true, existing: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Build lead record
  const lead: Lead = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    company: company?.trim() || '',
    created_at: new Date().toISOString(),
    sequence_step: 1,
    converted: false
  }

  // Save to blob store
  await saveLead(lead)

  // Send Email 1 — checklist delivery
  // Even if email fails, we keep the lead (don't throw)
  let previewUrl: string | undefined
  try {
    const result = await sendEmail({
      to: normalizedEmail,
      subject: 'Your Subcontract Cash Trap Checklist™',
      html: emailChecklist(lead.name)
    })
    previewUrl = result.previewUrl
  } catch (err) {
    console.error('Email send failed for lead:', normalizedEmail, err)
  }

  return new Response(JSON.stringify({ success: true, previewUrl }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  })
}

export const config: Config = {
  path: '/api/capture-lead'
}
