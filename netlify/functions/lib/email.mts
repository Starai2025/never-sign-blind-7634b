// ============================================================
// Never Sign Blind™ — Email Service
// Uses Resend in production, Ethereal (fake SMTP) in testing.
// Ethereal previews appear at the URL logged to console.
// ============================================================

import type { Review, ReviewDraft } from './types.mts'

interface EmailPayload {
  to: string
  subject: string
  html: string
  from?: string
}

// ── Send via Resend or Ethereal ──────────────────────────────

export async function sendEmail(payload: EmailPayload): Promise<{ previewUrl?: string }> {
  const resendKey = Netlify.env.get('RESEND_API_KEY')
  const fromEmail = Netlify.env.get('RESEND_FROM_EMAIL') || 'Starr at Never Sign Blind™ <starr@neversignblind.com>'

  if (resendKey) {
    // Production: use Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: payload.from || fromEmail,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html
      })
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Resend error: ${err}`)
    }
    return {}
  } else {
    // Testing: use Ethereal fake SMTP via nodemailer
    // Dynamically import to keep production bundle clean
    const nodemailer = await import('nodemailer')
    const testAccount = await nodemailer.default.createTestAccount()
    const transporter = nodemailer.default.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: testAccount.user, pass: testAccount.pass }
    })
    const info = await transporter.sendMail({
      from: payload.from || `"Never Sign Blind™" <${testAccount.user}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html
    })
    const previewUrl = nodemailer.default.getTestMessageUrl(info) as string
    console.log(`📧 TEST EMAIL — Preview at: ${previewUrl}`)
    return { previewUrl }
  }
}

// ── Email Templates ───────────────────────────────────────────

export function emailChecklist(name: string): string {
  return layout(`
    <h1>Your Subcontract Cash Trap Checklist™ is ready</h1>
    <p style="color:#374151;">Hi ${name},</p>
    <p>Before you sign anything this week, run through these 7 questions. If you answer "no" or "not sure" to any of them, do not sign blind.</p>
    <div style="background:#F4F7FA;border-left:4px solid #0D9E9E;padding:20px 24px;margin:24px 0;">
      <p style="font-weight:700;color:#0F2044;margin:0 0 16px;">The 7 Questions:</p>
      <ol style="color:#374151;line-height:2;margin:0;padding-left:20px;">
        <li>Is there a clear outside deadline for payment?</li>
        <li>Is retainage tied to your scope — not overall project closeout?</li>
        <li>Can the GC backcharge only with notice and documentation?</li>
        <li>Are notice deadlines for extra work realistic in the field?</li>
        <li>Are liquidated damages capped and tied to your actual scope?</li>
        <li>Is your responsibility limited to what your company controls?</li>
        <li>Are final payment and retainage release conditions clearly defined?</li>
      </ol>
    </div>
    <p>If you answered "no" or "not sure" to any of those — that subcontract deserves a closer look before you sign.</p>
    <div style="margin:32px 0;text-align:center;">
      <a href="https://never-sign-blind.netlify.app/intake.html" style="background:#0D9E9E;color:#fff;padding:14px 32px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Review My Deal Before I Sign →</a>
    </div>
    <p style="color:#6B7280;font-size:13px;">Founder pricing: $299 for the full Never Sign Blind™ Review. Upload by 2 PM, get your review by 5 PM.</p>
  `)
}

export function emailSampleReview(name: string): string {
  return layout(`
    <h1>Here's what a Never Sign Blind™ review looks like</h1>
    <p>Hi ${name},</p>
    <p>Wanted to follow up and show you exactly what you get when you send us a subcontract before signing.</p>

    <div style="background:#F4F7FA;border:1px solid #E2E8F0;padding:24px;margin:24px 0;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#94A3B8;margin-bottom:12px;">SAMPLE — Never Sign Blind™ Review</div>

      <div style="background:#FEF9EC;border:2px solid #F59E0B;padding:12px 18px;margin-bottom:20px;display:inline-block;">
        <strong style="color:#92400E;">⚠ NEGOTIATE BEFORE SIGNING</strong>
        <p style="margin:4px 0 0;color:#78350F;font-size:13px;">3 clauses flagged with high money-risk. Pushback on Items 1 and 2 before you commit.</p>
      </div>

      <p style="font-weight:700;color:#0F2044;margin-bottom:8px;">🔴 HIGH — §12.3 Pay-When-Paid Clause</p>
      <p style="color:#374151;font-size:14px;margin-bottom:16px;">Your payment is contingent on the GC getting paid by the owner. If the owner is late, your cash is stuck with no deadline and no recourse.</p>

      <p style="font-weight:700;color:#0F2044;margin-bottom:8px;">🟡 MED — §7.1 Retainage at Project Closeout</p>
      <p style="color:#374151;font-size:14px;margin-bottom:16px;">Your retainage isn't released when your scope is done — it's tied to full project closeout. Your money can sit 60–90 days after your last day on site.</p>

      <p style="font-weight:700;color:#0F2044;margin-bottom:8px;">📧 Pushback Script™ (ready to send):</p>
      <div style="background:#fff;border:1px solid #E2E8F0;padding:14px;font-family:monospace;font-size:13px;color:#374151;line-height:1.6;">
        "Before we execute, I want to flag two items. Section 12.3 creates open-ended payment exposure — can we agree on a fixed payment schedule? Section 7.1 ties our retainage to project closeout rather than our scope completion — can we align release to our substantial completion?"
      </div>
    </div>

    <p>That's what you get — delivered the same day, before your leverage is gone.</p>
    <div style="margin:32px 0;text-align:center;">
      <a href="https://never-sign-blind.netlify.app/intake.html" style="background:#0D9E9E;color:#fff;padding:14px 32px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Review My Deal Before I Sign →</a>
    </div>
  `)
}

export function emailFounderOffer(name: string): string {
  return layout(`
    <h1>Founder pricing closes when the first group fills</h1>
    <p>Hi ${name},</p>
    <p>Quick note. We're working with our first group of paving subcontractors right now at founder pricing — helping them review subcontracts before signing so they know where the money can get stuck and what to push back on.</p>

    <div style="background:#EBF9F9;border:1px solid #0D9E9E;padding:20px 24px;margin:24px 0;">
      <p style="font-weight:700;color:#0F2044;margin:0 0 12px;">Founder Pricing — Available Now</p>
      <p style="margin:0 0 6px;color:#374151;"><strong style="color:#0D9E9E;">$299</strong> — Full Never Sign Blind™ Review <span style="text-decoration:line-through;color:#94A3B8;font-size:13px;">Retail $750</span></p>
      <p style="margin:0;color:#374151;font-size:13px;">CashTrap Scan™ · Sign-with-Confidence Score™ · Pushback Script™ · Deadline Snapshot™ · PM Handoff Sheet™ · 1 Revision Recheck™</p>
    </div>

    <p>One question worth asking yourself: <strong>Do I have a subcontract on my desk right now that I haven't fully decoded?</strong></p>
    <p>If yes — send it before you sign. We'll show you the biggest money traps and the exact language to push back on today.</p>

    <div style="margin:32px 0;text-align:center;">
      <a href="https://never-sign-blind.netlify.app/intake.html" style="background:#0D9E9E;color:#fff;padding:14px 32px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Get My Review →</a>
    </div>
  `)
}

export function emailLastCall(name: string): string {
  return layout(`
    <h1>Last note before I stop following up</h1>
    <p>Hi ${name},</p>
    <p>Not going to keep filling your inbox. Last thought:</p>
    <p>The most common subcontract problems I see with paving subs are payment timing that drifts, retainage stuck 60–90 days after their scope is done, and notice windows that are basically impossible to hit in the field.</p>
    <p>If any of those have cost you money on a job, or if a subcontract lands on your desk and feels off — I'm happy to take a look before you sign.</p>
    <div style="margin:32px 0;text-align:center;">
      <a href="https://never-sign-blind.netlify.app/intake.html" style="background:#0F2044;color:#fff;padding:14px 32px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Review My Deal →</a>
    </div>
    <p style="color:#6B7280;font-size:13px;">If the timing isn't right, no worries. You can always find us at never-sign-blind.netlify.app when the next one lands.</p>
  `)
}

export function emailPaymentConfirmed(name: string, tier: string, deadline: string): string {
  return layout(`
    <h1>Payment confirmed — your review is in progress</h1>
    <p>Hi ${name},</p>
    <p>Got it. Your payment is confirmed and your subcontract review is in the queue.</p>
    <div style="background:#F0FDF4;border:1px solid #86EFAC;padding:20px 24px;margin:24px 0;">
      <p style="font-weight:700;color:#166534;margin:0 0 8px;">✓ ${tier} — Payment Received</p>
      <p style="margin:0;color:#374151;font-size:14px;">Deadline you specified: <strong>${deadline}</strong></p>
    </div>
    <p><strong>What happens next:</strong></p>
    <ol style="color:#374151;line-height:2;">
      <li>We run the CashTrap Scan™ on your subcontract</li>
      <li>We build your decision package — Score, Pushback Script™, Deadline Snapshot™, PM Handoff Sheet™</li>
      <li>You get the full review by 5 PM (or within your rush window)</li>
    </ol>
    <p>If anything urgent comes up before then, reply to this email.</p>
    <p style="color:#6B7280;font-size:13px;">Clear Before You Sign Guarantee™ — if we don't deliver a clear sign/negotiate/walk decision before your deadline, we redo it free.</p>
  `)
}

export function emailNewReviewAlert(review: {
  name: string, company: string, email: string,
  tier: string, deadline: string, price: number, id: string
}, adminToken: string): string {
  const adminUrl = `https://never-sign-blind.netlify.app/admin.html#review/${review.id}`
  return layout(`
    <h1>🔔 New Paid Review — Action Required</h1>
    <div style="background:#FEF9EC;border:2px solid #F59E0B;padding:20px 24px;margin:24px 0;">
      <p style="margin:0 0 8px;"><strong>Client:</strong> ${review.name} at ${review.company}</p>
      <p style="margin:0 0 8px;"><strong>Email:</strong> ${review.email}</p>
      <p style="margin:0 0 8px;"><strong>Tier:</strong> ${review.tier} — <strong>$${review.price}</strong></p>
      <p style="margin:0;"><strong>Deadline:</strong> ${review.deadline}</p>
    </div>
    <p>The AI is generating the review draft now. You'll get another email when it's ready to approve.</p>
    <div style="margin:32px 0;text-align:center;">
      <a href="${adminUrl}" style="background:#0F2044;color:#fff;padding:14px 32px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">View in Admin Dashboard →</a>
    </div>
  `)
}

export function emailDraftReady(review: Review, draft: ReviewDraft, adminToken: string): string {
  const approveUrl = `https://never-sign-blind.netlify.app/api/approve-review?id=${review.id}&token=${adminToken}`
  const adminUrl = `https://never-sign-blind.netlify.app/admin.html#review/${review.id}`
  const scoreColor = draft.score === 'SAFE' ? '#166534' : draft.score === 'NEGOTIATE' ? '#92400E' : '#991B1B'
  const scoreBg = draft.score === 'SAFE' ? '#F0FDF4' : draft.score === 'NEGOTIATE' ? '#FEF9EC' : '#FEF2F2'

  return layout(`
    <h1>✅ AI Review Draft Ready — Approve or Edit</h1>
    <p><strong>${review.name}</strong> at <strong>${review.company}</strong> · ${review.tier} · Deadline: ${review.deadline}</p>

    <div style="background:${scoreBg};border:2px solid ${scoreColor};padding:16px 20px;margin:20px 0;">
      <p style="font-weight:800;color:${scoreColor};font-size:18px;margin:0;">${draft.score.replace('_', ' ')}</p>
      <p style="margin:4px 0 0;color:#374151;font-size:14px;">${draft.score_reason}</p>
    </div>

    <p><strong>Top Traps Found (${draft.cashtrap_scan.length}):</strong></p>
    ${draft.cashtrap_scan.slice(0, 3).map(t => `
      <div style="border-left:3px solid ${t.severity === 'HIGH' ? '#EF4444' : t.severity === 'MED' ? '#F59E0B' : '#6B7280'};padding:8px 14px;margin-bottom:8px;">
        <p style="margin:0;font-weight:700;font-size:13px;color:#0F2044;">${t.severity} — ${t.clause_ref}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#374151;">${t.plain_english}</p>
      </div>
    `).join('')}

    <div style="margin:32px 0;display:flex;gap:12px;text-align:center;">
      <a href="${approveUrl}" style="background:#0D9E9E;color:#fff;padding:14px 28px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;margin-right:12px;">✓ Approve &amp; Send to Client</a>
      <a href="${adminUrl}" style="background:#0F2044;color:#fff;padding:14px 28px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">✎ Edit in Dashboard</a>
    </div>
    <p style="color:#6B7280;font-size:12px;">Risk Score: ${draft.overall_risk_score}/100 · Prompt: ${draft.prompt_version}</p>
  `)
}

export function emailFinalReview(review: Review, draft: ReviewDraft): string {
  const scoreLabel = draft.score === 'SAFE' ? '✓ SAFE TO SIGN WITH NOTES' : draft.score === 'NEGOTIATE' ? '⚠ NEGOTIATE BEFORE SIGNING' : '✕ DO NOT SIGN AS-IS'
  const scoreColor = draft.score === 'SAFE' ? '#166534' : draft.score === 'NEGOTIATE' ? '#92400E' : '#991B1B'
  const scoreBg = draft.score === 'SAFE' ? '#F0FDF4' : draft.score === 'NEGOTIATE' ? '#FEF9EC' : '#FEF2F2'

  return layout(`
    <h1>Your Never Sign Blind™ Review Is Ready</h1>
    <p>Hi ${review.name},</p>
    <p>Here is your pre-signature profit protection review for ${review.company}. This is your decision package — everything you need before you sign.</p>

    <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;">

    <!-- Score -->
    <h2 style="color:#0F2044;font-size:16px;margin-bottom:8px;">Sign-with-Confidence Score™</h2>
    <div style="background:${scoreBg};border:2px solid ${scoreColor};padding:16px 20px;margin-bottom:24px;">
      <p style="font-weight:800;color:${scoreColor};font-size:20px;margin:0;">${scoreLabel}</p>
      <p style="margin:8px 0 0;color:#374151;">${draft.score_reason}</p>
    </div>

    <!-- CashTrap Scan -->
    <h2 style="color:#0F2044;font-size:16px;margin-bottom:12px;">CashTrap Scan™ — Money Traps Found</h2>
    ${draft.cashtrap_scan.map(trap => `
      <div style="border-left:4px solid ${trap.severity === 'HIGH' ? '#EF4444' : trap.severity === 'MED' ? '#F59E0B' : '#94A3B8'};padding:12px 16px;margin-bottom:12px;background:#F8FAFC;">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
          <span style="font-size:11px;font-weight:800;color:${trap.severity === 'HIGH' ? '#EF4444' : trap.severity === 'MED' ? '#F59E0B' : '#94A3B8'};text-transform:uppercase;">${trap.severity}</span>
          <span style="font-weight:700;color:#0F2044;font-size:14px;">${trap.clause_ref}</span>
        </div>
        <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>What it means:</strong> ${trap.plain_english}</p>
        <p style="margin:0 0 4px;color:#374151;font-size:13px;">${trap.what_it_means}</p>
        <p style="margin:0;color:#0D9E9E;font-size:13px;"><strong>Pushback:</strong> ${trap.pushback}</p>
      </div>
    `).join('')}

    <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;">

    <!-- Pushback Script -->
    <h2 style="color:#0F2044;font-size:16px;margin-bottom:12px;">Pushback Script™ — Ready to Send to Your GC</h2>
    <div style="background:#F4F7FA;border:1px solid #E2E8F0;padding:16px;font-family:monospace;font-size:13px;color:#374151;line-height:1.7;white-space:pre-wrap;">${draft.pushback_script}</div>

    <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;">

    <!-- Deadline Snapshot -->
    <h2 style="color:#0F2044;font-size:16px;margin-bottom:12px;">Deadline Snapshot™ — Critical Dates</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr style="background:#0F2044;">
        <th style="color:#fff;padding:8px 12px;text-align:left;font-size:12px;">Deadline</th>
        <th style="color:#fff;padding:8px 12px;text-align:left;font-size:12px;">Window</th>
        <th style="color:#fff;padding:8px 12px;text-align:left;font-size:12px;">Risk Note</th>
      </tr>
      ${draft.deadline_snapshot.map((d, i) => `
        <tr style="background:${i % 2 === 0 ? '#F8FAFC' : '#fff'};">
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#0F2044;">${d.label}</td>
          <td style="padding:8px 12px;font-size:13px;color:#374151;">${d.value}</td>
          <td style="padding:8px 12px;font-size:13px;color:#6B7280;">${d.risk_note}</td>
        </tr>
      `).join('')}
    </table>

    <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;">

    <!-- PM Handoff -->
    <h2 style="color:#0F2044;font-size:16px;margin-bottom:12px;">PM Handoff Sheet™ — What Your PM Must Track</h2>
    ${draft.pm_handoff.map(item => `
      <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px;">
        <span style="background:${item.priority === 'CRITICAL' ? '#EF4444' : item.priority === 'HIGH' ? '#F59E0B' : '#94A3B8'};color:#fff;font-size:10px;font-weight:800;padding:2px 8px;white-space:nowrap;margin-top:2px;">${item.priority}</span>
        <div>
          <p style="margin:0;font-weight:700;font-size:13px;color:#0F2044;">${item.item}</p>
          <p style="margin:2px 0 0;font-size:13px;color:#374151;">${item.action}</p>
        </div>
      </div>
    `).join('')}

    <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;">

    <div style="background:#EBF9F9;border:1px solid #0D9E9E;padding:16px 20px;">
      <p style="font-weight:700;color:#0F2044;margin:0 0 4px;">Clear Before You Sign Guarantee™</p>
      <p style="margin:0;color:#374151;font-size:13px;">If this review didn't give you a clear sign/negotiate/walk decision, reply to this email and we'll redo it free.</p>
    </div>

    <p style="color:#6B7280;font-size:12px;margin-top:24px;">Not legal advice. Not a law firm. Built for small subcontractors who need clarity fast. © 2025 Never Sign Blind™</p>
  `)
}

// ── Layout wrapper ────────────────────────────────────────────

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #F4F7FA; color: #1F2937; }
  .wrapper { max-width: 620px; margin: 0 auto; background: #fff; }
  .header { background: #0F2044; padding: 20px 32px; }
  .header-brand { color: #fff; font-size: 18px; font-weight: 800; letter-spacing: 1px; margin: 0; }
  .header-sub { color: #0D9E9E; font-size: 12px; margin: 2px 0 0; }
  .body { padding: 32px; }
  h1 { color: #0F2044; font-size: 22px; margin: 0 0 16px; line-height: 1.3; }
  h2 { color: #0F2044; font-size: 16px; margin: 24px 0 12px; }
  p { line-height: 1.6; margin: 0 0 14px; }
  .footer { background: #F4F7FA; padding: 20px 32px; border-top: 1px solid #E2E8F0; }
  .footer p { color: #94A3B8; font-size: 12px; margin: 0; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <p class="header-brand">NEVER SIGN BLIND™</p>
    <p class="header-sub">Profit Protection for Subcontractors</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    <p>Never Sign Blind™ · never-sign-blind.netlify.app · Not legal advice · Not a law firm</p>
    <p style="margin-top:4px;">© 2025 Never Sign Blind™. You're receiving this because you opted in at our site.</p>
  </div>
</div>
</body>
</html>`
}
