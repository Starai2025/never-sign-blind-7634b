// ============================================================
// Never Sign Blind™ — Shared Types
// ============================================================

export type ReviewTier = 'quick' | 'full' | 'rush'
export type ReviewScore = 'SAFE' | 'NEGOTIATE' | 'DO_NOT_SIGN'
export type DraftStatus = 'pending' | 'generating' | 'generated' | 'approved' | 'delivered' | 'error'
export type Severity = 'HIGH' | 'MED' | 'LOW'
export type SequenceStep = 1 | 2 | 3 | 4

export interface Lead {
  id: string
  name: string
  email: string
  company: string
  created_at: string
  sequence_step: SequenceStep
  converted: boolean
  converted_at?: string
}

export interface CashTrapItem {
  clause_ref: string
  category: string
  severity: Severity
  plain_english: string
  what_it_means: string
  pushback: string
}

export interface DeadlineItem {
  label: string
  value: string
  risk_note: string
}

export interface PMHandoffItem {
  item: string
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL'
  action: string
}

export interface ReviewDraft {
  score: ReviewScore
  score_reason: string
  overall_risk_score: number
  cashtrap_scan: CashTrapItem[]
  deadline_snapshot: DeadlineItem[]
  pm_handoff: PMHandoffItem[]
  pushback_script: string
  prompt_version: string
  generated_at: string
}

export interface Review {
  id: string
  name: string
  email: string
  company: string
  phone: string
  tier: ReviewTier
  price: number
  deadline: string
  context: string
  stripe_session_id: string
  paid: boolean
  paid_at?: string
  file_key: string
  draft_status: DraftStatus
  ai_draft?: ReviewDraft
  ai_prompt_version?: string
  delivered: boolean
  delivered_at?: string
  internal_notes: string
  created_at: string
}

export interface OutreachContact {
  id: string
  company: string
  contact_name: string
  title: string
  email: string
  linkedin: string
  first_outreach_date: string
  channel: string
  pain_angle: string
  reply_status: 'none' | 'replied' | 'not-interested' | 'sample-requested' | 'closed'
  sample_sent: boolean
  review_sold: boolean
  testimonial_requested: boolean
  testimonial_received: boolean
  notes: string
  created_at: string
}

export const TIER_PRICES: Record<ReviewTier, number> = {
  quick: 99,
  full: 299,
  rush: 499
}

export const TIER_LABELS: Record<ReviewTier, string> = {
  quick: 'Quick Clause Check',
  full: 'Never Sign Blind™ Review',
  rush: 'Rush Review'
}
