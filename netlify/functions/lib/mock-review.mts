// ============================================================
// Never Sign Blind™ — Mock Review Generator
// Returns a realistic paving subcontract review for testing.
// Used when ANTHROPIC_API_KEY is not set.
// ============================================================

import type { ReviewDraft } from './types.mts'

export function getMockReview(reviewId: string): ReviewDraft {
  return {
    score: 'NEGOTIATE',
    score_reason: 'Two high-severity payment and retainage clauses identified that directly threaten cash flow — the deal is worth saving with targeted pushback on §12.3 and §7.1 before signing.',
    overall_risk_score: 72,
    cashtrap_scan: [
      {
        clause_ref: '§12.3 — Payment Terms',
        category: 'pay-when-paid',
        severity: 'HIGH',
        plain_english: 'You only get paid when the GC gets paid by the owner — no deadline, no cap.',
        what_it_means: 'If the owner is slow, disputes a payment, or goes bankrupt, your cash is stuck indefinitely with no legal deadline to force payment.',
        pushback: 'Request a "pay-when-paid with backstop" — add language that GC must pay you within 45 days regardless of owner payment status. Most GCs will negotiate this.'
      },
      {
        clause_ref: '§7.1 — Retainage',
        category: 'retainage',
        severity: 'HIGH',
        plain_english: 'Your 10% retainage is held until final project closeout — not when your paving scope is complete.',
        what_it_means: 'You could finish your asphalt work in month 3 of a 12-month project and wait 9+ additional months to collect money you\'ve already earned. On a $400K job, that\'s $40K sitting idle.',
        pushback: 'Push for retainage release tied to your substantial completion, not overall project closeout. Suggest: "Retainage for Subcontractor\'s scope shall be released within 30 days of Subcontractor\'s substantial completion of its work."'
      },
      {
        clause_ref: '§18.4 — Notice of Extra Work',
        category: 'notice',
        severity: 'HIGH',
        plain_english: 'You must give written notice of any extra work within 48 hours or you waive the right to claim it.',
        what_it_means: 'In field conditions, a 48-hour notice window is realistically impossible. A changed condition on a Friday afternoon means you lose recovery rights by Sunday if you miss the window.',
        pushback: 'Request 7 calendar days for written notice, or at minimum 5 business days. Also push to remove "time is of the essence" language tied to this clause.'
      },
      {
        clause_ref: '§9.2 — Backcharges',
        category: 'backcharge',
        severity: 'MED',
        plain_english: 'GC can deduct backcharges from your payments at any time without prior written notice.',
        what_it_means: 'You could receive a payment 30% lower than expected with no advance warning. Disputing it mid-job is difficult — you\'re already on site and dependent on the GC.',
        pushback: 'Request that all backcharges require 5-day prior written notice with documentation. Without notice, backcharge is waived.'
      },
      {
        clause_ref: '§22.1 — Liquidated Damages',
        category: 'liquidated-damages',
        severity: 'MED',
        plain_english: 'You are exposed to liquidated damages for project delays without a cap tied to your actual scope.',
        what_it_means: 'If the overall project is delayed for reasons partially outside your control, you could be assessed LD charges that exceed your profit margin on this job.',
        pushback: 'Request that LD exposure be capped at your contract value and limited to delays directly caused by your work. Ask to see the prime contract LD clause before signing.'
      }
    ],
    deadline_snapshot: [
      {
        label: 'Extra Work Notice',
        value: '48 hours written',
        risk_note: 'Extremely tight — likely to be missed in real field conditions'
      },
      {
        label: 'Delay Claim Notice',
        value: '30 days written',
        risk_note: 'Manageable but must be logged from day one'
      },
      {
        label: 'Retainage Release',
        value: 'Project closeout — not scope completion',
        risk_note: 'HIGH RISK — money trapped well beyond your last day on site'
      },
      {
        label: 'Payment Terms',
        value: 'Pay-when-paid — no outside deadline',
        risk_note: 'HIGH RISK — no backstop if owner is slow or disputes payment'
      },
      {
        label: 'Dispute Response',
        value: '21 days to respond to GC claims',
        risk_note: 'Normal — calendar this immediately'
      }
    ],
    pm_handoff: [
      {
        item: 'Log all change directions immediately',
        priority: 'CRITICAL',
        action: '48-hour notice window starts the moment any direction is given. Log every verbal and written direction with date and time. Confirm in writing same day.'
      },
      {
        item: 'Track your scope completion date separately',
        priority: 'CRITICAL',
        action: 'Document substantial completion of your paving scope with photos and written notice to GC. This is your evidence for retainage release negotiation.'
      },
      {
        item: 'Request daily extra work authorization forms',
        priority: 'HIGH',
        action: 'Do not perform any out-of-scope work without written GC authorization. Pre-print authorization forms and keep in truck.'
      },
      {
        item: 'Monitor weather and site delays from day one',
        priority: 'HIGH',
        action: 'Keep daily site logs noting any delay conditions caused by others. This is your LD defense documentation.'
      },
      {
        item: 'Flag any backcharge deductions within 5 days',
        priority: 'NORMAL',
        action: 'Review every payment application against your invoice. Dispute any unexplained deductions in writing immediately.'
      }
    ],
    pushback_script: `Hi [GC Contact Name],

Before we execute the subcontract, I want to flag two items for a quick conversation.

Section 12.3 as written creates open-ended payment exposure on our end based on owner funding timing. We'd like to discuss either adding a pay-when-paid backstop (45 days regardless of owner payment) or converting to a fixed payment schedule. We're comfortable with reasonable terms — just need a defined outside date.

Section 7.1 ties our retainage to full project closeout rather than our scope completion. On a paving scope that wraps up well before overall project closeout, this creates a significant cash timing issue. We'd like to discuss tying our retainage release to our substantial completion within 30 days, rather than the full project closeout date.

We want to make this work and get started — these are the two items we'd like to resolve before we execute. Happy to jump on a quick call today or tomorrow.

Best,
[Your Name]
[Company]
[Phone]`,
    prompt_version: 'v1',
    generated_at: new Date().toISOString()
  }
}
