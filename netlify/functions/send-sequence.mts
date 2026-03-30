// ============================================================
// Never Sign Blind™ — Email Sequence Runner
// Scheduled: runs daily at 2pm UTC (10am ET)
// Sends Day 2, Day 4, and Day 7 follow-up emails
// to leads who haven't converted yet.
// ============================================================

import type { Config } from '@netlify/functions'
import { listLeads, updateLeadStep } from './lib/blobs.mts'
import { sendEmail, emailSampleReview, emailFounderOffer, emailLastCall } from './lib/email.mts'

export default async (req: Request) => {
  const { next_run } = await req.json()
  console.log(`Email sequence runner fired. Next run: ${next_run}`)

  const leads = await listLeads()
  const now = new Date()

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const lead of leads) {
    // Skip converted leads — they bought, no more nurturing
    if (lead.converted) { skipped++; continue }

    // Skip completed sequences
    if (lead.sequence_step >= 4) { skipped++; continue }

    const createdAt = new Date(lead.created_at)
    const daysSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)

    try {
      // Day 2: Send sample review
      if (lead.sequence_step === 1 && daysSince >= 2) {
        await sendEmail({
          to: lead.email,
          subject: "Here's what a Never Sign Blind™ review looks like",
          html: emailSampleReview(lead.name)
        })
        await updateLeadStep(lead.email, 2)
        sent++
        console.log(`Sent Email 2 (sample) to ${lead.email}`)
      }
      // Day 4: Founder offer
      else if (lead.sequence_step === 2 && daysSince >= 4) {
        await sendEmail({
          to: lead.email,
          subject: 'Founder pricing closes when the first group fills',
          html: emailFounderOffer(lead.name)
        })
        await updateLeadStep(lead.email, 3)
        sent++
        console.log(`Sent Email 3 (founder offer) to ${lead.email}`)
      }
      // Day 7: Last call
      else if (lead.sequence_step === 3 && daysSince >= 7) {
        await sendEmail({
          to: lead.email,
          subject: 'Last note before I stop following up',
          html: emailLastCall(lead.name)
        })
        await updateLeadStep(lead.email, 4)
        sent++
        console.log(`Sent Email 4 (last call) to ${lead.email}`)
      } else {
        skipped++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`Email failed for ${lead.email}:`, msg)
      errors.push(`${lead.email}: ${msg}`)
    }
  }

  console.log(`Sequence complete — Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors.length}`)
}

export const config: Config = {
  schedule: '0 14 * * *'
}
