'use strict';

require('dotenv').config();

const twilio = require('twilio');
const { Resend } = require('resend');

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const resend = new Resend(process.env.RESEND_API_KEY);

const SMS_RECIPIENTS   = (process.env.SMS_RECIPIENTS || '').split(',').map(s => s.trim()).filter(Boolean);
const EMAIL_RECIPIENTS = (process.env.EMAIL_RECIPIENTS || '').split(',').map(s => s.trim()).filter(Boolean);
const FROM_PHONE       = process.env.TWILIO_PHONE_NUMBER;

// ---------------------------------------------------------------------------
// SMS
// ---------------------------------------------------------------------------

/**
 * Format a lead object into the SMS body text.
 * @param {object} lead
 * @returns {string}
 */
function formatSms(lead) {
  const awd      = lead.vehicle?.awd === true ? 'Yes' : lead.vehicle?.awd === false ? 'No' : 'Unknown';
  const vehicle  = [lead.vehicle?.year, lead.vehicle?.make, lead.vehicle?.model].filter(Boolean).join(' ') || 'N/A';
  const customer = lead.customerType === 'new'
    ? `New (via ${lead.referralSource || 'unknown'})`
    : lead.customerType === 'returning' ? 'Returning' : 'Unknown';

  const ts = lead.timestamp
    ? new Date(lead.timestamp).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' })
    : 'N/A';

  const lines = [
    '📞 New Lead — M.R. Automotive',
    '─────────────────────',
    `👤 Name:     ${lead.name || 'N/A'}`,
    `📱 Phone:    ${lead.phone || 'N/A'}`,
    `🚗 Vehicle:  ${vehicle}`,
    `4WD:         ${awd}`,
    `👋 Customer: ${customer}`,
    '─────────────────────',
    `🔧 Service:  ${lead.service || 'N/A'}`,
  ];

  if (lead.serviceDetail) lines.push(`📋 ${lead.serviceDetail}`);
  if (lead.comments)      lines.push(`📝 ${lead.comments}`);

  lines.push('─────────────────────');
  lines.push(`🕐 ${ts}`);

  return lines.join('\n');
}

/**
 * Send SMS notifications to all configured recipients.
 * @param {object} lead
 * @returns {Promise<void>}
 */
async function sendSms(lead) {
  const body = formatSms(lead);
  const results = await Promise.allSettled(
    SMS_RECIPIENTS.map(to =>
      twilioClient.messages.create({ from: FROM_PHONE, to, body })
    )
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`SMS to ${SMS_RECIPIENTS[i]} failed:`, r.reason);
    } else {
      console.log(`SMS sent to ${SMS_RECIPIENTS[i]}: ${r.value.sid}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

/**
 * Format a lead object as an HTML email body.
 * @param {object} lead
 * @returns {string}
 */
function formatEmailHtml(lead) {
  const awd     = lead.vehicle?.awd === true ? 'Yes' : lead.vehicle?.awd === false ? 'No' : 'Unknown';
  const vehicle = [lead.vehicle?.year, lead.vehicle?.make, lead.vehicle?.model].filter(Boolean).join(' ') || 'N/A';
  const customer = lead.customerType === 'new'
    ? `New${lead.referralSource ? ` (via ${lead.referralSource})` : ''}`
    : lead.customerType === 'returning' ? 'Returning' : 'Unknown';

  const ts = lead.timestamp ? new Date(lead.timestamp).toLocaleString('en-CA', {
    timeZone: 'America/Toronto',
    dateStyle: 'full',
    timeStyle: 'short',
  }) : 'N/A';

  const dur = lead.callDuration
    ? `${Math.floor(lead.callDuration / 60)}m ${lead.callDuration % 60}s`
    : 'N/A';

  const row = (label, value) =>
    `<tr>
      <td style="padding:8px 12px;font-weight:600;background:#f5f5f5;border:1px solid #ddd;white-space:nowrap;color:#444;">${label}</td>
      <td style="padding:8px 12px;border:1px solid #ddd;color:#222;">${value || 'N/A'}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f0f0f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr>
          <td style="background:#c0392b;padding:24px 30px;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">📞 New Appointment Request</h1>
            <p style="margin:6px 0 0;color:#ffd5d5;font-size:14px;">M.R. Automotive — AI Voice Receptionist</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:24px 30px;">
            <p style="margin:0 0 16px;font-size:15px;color:#333;">
              A new lead was captured by Sarah (AI receptionist). Please follow up to confirm the appointment.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;">
              ${row('Name', lead.name)}
              ${row('Phone', lead.phone)}
              ${row('Service Requested', lead.service)}
              ${lead.serviceDetail ? row('Issue Details', lead.serviceDetail) : ''}
              ${row('Vehicle', vehicle)}
              ${row('AWD', awd)}
              ${row('Customer Type', customer)}
              ${row('Notes / Comments', lead.comments)}
              ${row('Call Duration', dur)}
              ${row('Timestamp', ts)}
            </table>

            <p style="margin:0;font-size:13px;color:#888;">
              This notification was sent automatically by the M.R. Automotive AI Voice Receptionist.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f5f5f5;padding:14px 30px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
              M.R. Automotive · 300 Dundas St E, Whitby, ON · 905-430-1633
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Send email notifications to all configured recipients.
 * @param {object} lead
 * @returns {Promise<void>}
 */
async function sendEmail(lead) {
  const name    = lead.name || 'Unknown Caller';
  const service = lead.service || 'General Inquiry';
  const subject = `New Appointment Request — ${name} — ${service}`;
  const html    = formatEmailHtml(lead);

  const results = await Promise.allSettled(
    EMAIL_RECIPIENTS.map(to =>
      resend.emails.send({
        from:    'onboarding@resend.dev',
        to:      [to],
        subject,
        html,
      })
    )
  );

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`Email to ${EMAIL_RECIPIENTS[i]} failed:`, r.reason);
    } else {
      console.log(`Email sent to ${EMAIL_RECIPIENTS[i]}:`, r.value?.data?.id || 'ok');
    }
  });
}

/**
 * Send both SMS and email notifications.
 * Skips sending if no contact info (name or phone) was collected.
 * @param {object} lead
 * @returns {Promise<void>}
 */
async function sendNotifications(lead) {
  const hasContact = (lead.name && lead.name.trim()) || (lead.phone && lead.phone.trim());
  if (!hasContact) {
    console.log('No contact info collected — skipping notifications.');
    return;
  }
  console.log('Sending lead notifications:', JSON.stringify(lead, null, 2));
  await Promise.allSettled([sendSms(lead), sendEmail(lead)]);
}

module.exports = { sendNotifications, formatSms, formatEmailHtml };
