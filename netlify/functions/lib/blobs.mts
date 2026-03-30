// ============================================================
// Never Sign Blind™ — Blob Store Helpers
// Automatically uses global store in production,
// deploy store in preview/dev to keep data isolated.
// ============================================================

import { getStore, getDeployStore } from '@netlify/blobs'
import type { Lead, Review, OutreachContact, ReviewDraft } from './types.mts'

function getBlobStore(name: string) {
  const isProduction = Netlify.env.get('NODE_ENV') === 'production'
  return isProduction ? getStore(name) : getDeployStore(name)
}

// ── Lead Store ───────────────────────────────────────────────

export const leadsStore = () => getBlobStore('leads')

export async function saveLead(lead: Lead): Promise<void> {
  await leadsStore().setJSON(lead.email.toLowerCase(), lead)
}

export async function getLead(email: string): Promise<Lead | null> {
  return await leadsStore().get(email.toLowerCase(), { type: 'json' })
}

export async function listLeads(): Promise<Lead[]> {
  const store = leadsStore()
  const { blobs } = await store.list()
  const leads: Lead[] = []
  for (const blob of blobs) {
    const lead = await store.get(blob.key, { type: 'json' })
    if (lead) leads.push(lead)
  }
  return leads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function updateLeadStep(email: string, step: number, converted = false): Promise<void> {
  const lead = await getLead(email)
  if (!lead) return
  lead.sequence_step = step as Lead['sequence_step']
  if (converted) {
    lead.converted = true
    lead.converted_at = new Date().toISOString()
  }
  await saveLead(lead)
}

// ── Review Store ─────────────────────────────────────────────

export const reviewsStore = () => getBlobStore('reviews')

export async function saveReview(review: Review): Promise<void> {
  await reviewsStore().setJSON(review.id, review)
}

export async function getReview(id: string): Promise<Review | null> {
  return await reviewsStore().get(id, { type: 'json' })
}

export async function listReviews(): Promise<Review[]> {
  const store = reviewsStore()
  const { blobs } = await store.list()
  const reviews: Review[] = []
  for (const blob of blobs) {
    const review = await store.get(blob.key, { type: 'json' })
    if (review) reviews.push(review)
  }
  return reviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function updateReview(id: string, updates: Partial<Review>): Promise<void> {
  const review = await getReview(id)
  if (!review) throw new Error(`Review ${id} not found`)
  await saveReview({ ...review, ...updates })
}

// ── PDF Store ────────────────────────────────────────────────

export const pdfsStore = () => getBlobStore('pdfs')

export async function savePDF(reviewId: string, buffer: ArrayBuffer): Promise<void> {
  await pdfsStore().set(reviewId, buffer)
}

export async function getPDF(reviewId: string): Promise<ArrayBuffer | null> {
  return await pdfsStore().get(reviewId, { type: 'arrayBuffer' })
}

// ── Config Store ─────────────────────────────────────────────

export const configStore = () => getBlobStore('nsb-config')

export async function getPrompt(): Promise<string> {
  const stored = await configStore().get('prompt/v1', { type: 'text' })
  return stored || DEFAULT_PROMPT
}

export async function savePrompt(prompt: string): Promise<void> {
  await configStore().set('prompt/v1', prompt)
}

export async function getClauseWeights(): Promise<Record<string, unknown>> {
  const stored = await configStore().get('clause-weights/v1', { type: 'json' })
  return stored || DEFAULT_CLAUSE_WEIGHTS
}

// ── Outreach Store ───────────────────────────────────────────

export const outreachStore = () => getBlobStore('outreach')

export async function saveOutreach(contact: OutreachContact): Promise<void> {
  await outreachStore().setJSON(contact.id, contact)
}

export async function listOutreach(): Promise<OutreachContact[]> {
  const store = outreachStore()
  const { blobs } = await store.list()
  const contacts: OutreachContact[] = []
  for (const blob of blobs) {
    const c = await store.get(blob.key, { type: 'json' })
    if (c) contacts.push(c)
  }
  return contacts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

// ── Default Prompt ───────────────────────────────────────────

export const DEFAULT_PROMPT = `You are a construction subcontract analyst for Never Sign Blind™ — a profit protection service built specifically for small paving subcontractors.

Your job is to review a subcontract PDF and identify every clause that could delay payment, trap retainage, create backcharge exposure, impose unrealistic notice requirements, shift liability unfairly, or otherwise hurt the subcontractor's cash flow or profit.

BUYER CONTEXT:
- Small paving subcontractor (owner or estimator)
- Revenue: $100K–$10M
- No in-house legal team
- Active signing decision — they need clarity NOW

OUTPUT RULES:
- Return ONLY valid JSON matching the schema below
- No preamble, no explanation outside the JSON
- Use plain English — no legalese
- Focus on money, risk, and leverage
- Be specific: cite actual section numbers when visible

CLAUSE CATEGORIES TO ANALYZE (in order of money impact):
1. pay-when-paid / pay-if-paid
2. retainage amount and release conditions
3. payment timing and milestones
4. change order / extra work notice requirements
5. notice deadlines (general)
6. backcharge rights and procedures
7. liquidated damages scope and caps
8. delay liability and schedule risk
9. indemnity and risk shifting
10. termination rights and payment on termination
11. final payment and closeout conditions
12. flow-down obligations
13. scope of work and responsibility limits
14. dispute resolution

RISK WEIGHT GUIDE:
- HIGH (7-10): Direct cash flow threat, payment delay, or retainage trap
- MED (4-6): Execution risk, notice traps, backcharge exposure
- LOW (1-3): Procedural risk, manageable with good PM practices

SCORING LOGIC:
- SAFE: No HIGH severity items, fewer than 3 MED items
- NEGOTIATE: 1-2 HIGH severity items OR 3+ MED items — deal worth saving with pushback
- DO_NOT_SIGN: 3+ HIGH severity items OR uncapped LD + pay-if-paid + retainage-at-closeout combination

REQUIRED JSON SCHEMA:
{
  "score": "SAFE" | "NEGOTIATE" | "DO_NOT_SIGN",
  "score_reason": "One sentence plain-English explanation of the score",
  "overall_risk_score": <number 0-100>,
  "cashtrap_scan": [
    {
      "clause_ref": "§12.3 or 'Section 12, Paragraph 3' or 'Payment Terms'",
      "category": "pay-when-paid | retainage | notice | backcharge | liquidated-damages | delay | indemnity | termination | final-payment | change-order | scope | flow-down | dispute",
      "severity": "HIGH" | "MED" | "LOW",
      "plain_english": "What this clause actually means in one sentence",
      "what_it_means": "Specific cash flow or risk impact for this subcontractor",
      "pushback": "Exact language or approach to push back on this clause"
    }
  ],
  "deadline_snapshot": [
    {
      "label": "Notice for Extra Work",
      "value": "48 hours written",
      "risk_note": "Extremely tight — likely to be missed in field conditions"
    }
  ],
  "pm_handoff": [
    {
      "item": "Track all change direction dates",
      "priority": "CRITICAL" | "HIGH" | "NORMAL",
      "action": "Log every verbal or written direction with timestamp — 48-hr notice window starts immediately"
    }
  ],
  "pushback_script": "Full ready-to-send email to the GC addressing the top 2-3 issues identified",
  "prompt_version": "v1"
}`

// ── Default Clause Weights ────────────────────────────────────

export const DEFAULT_CLAUSE_WEIGHTS = {
  'pay-when-paid': { base_weight: 9, note: 'Highest cash flow risk' },
  'pay-if-paid': { base_weight: 10, note: 'Absolute highest — payment contingent on owner' },
  'retainage-closeout': { base_weight: 8, note: 'Money trapped beyond scope control' },
  'notice-under-48h': { base_weight: 8, note: 'Realistically impossible in field' },
  'ld-uncapped': { base_weight: 7, note: 'Unlimited delay exposure' },
  'broad-indemnity': { base_weight: 7, note: 'Takes on GC/owner risk' },
  'termination-no-profit': { base_weight: 7, note: 'Walk away with nothing' },
  'backcharge-no-notice': { base_weight: 6, note: 'Surprise deductions' },
  'change-order-waiver': { base_weight: 6, note: 'Kills change recovery' },
  'final-payment-vague': { base_weight: 6, note: 'Money stuck at closeout' },
  'flow-down-unlimited': { base_weight: 5, note: 'Inherits prime contract risk' },
  'dispute-no-stop-work': { base_weight: 4, note: 'Must keep working during disputes' }
}
