export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const PIXEL_ID    = '2712586292441607';
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

  try {
    const body = req.body;

    // GHL sends appointment data when status changes
    // We only fire Schedule when status = 'confirmed'
    const status = body?.appointmentStatus || body?.status || '';
    if (status.toLowerCase() !== 'confirmed') {
      return res.status(200).json({ skipped: true, reason: 'Not confirmed' });
    }

    // Extract contact info for CAPI matching
    const contact = body?.contact || {};
    const email   = contact?.email || body?.email || '';
    const phone   = contact?.phone || body?.phone || '';
    const name    = contact?.name  || body?.name  || '';

    // Hash helper (SHA-256)
    const { createHash } = await import('crypto');
    const hash = (val) => val
      ? createHash('sha256').update(val.trim().toLowerCase()).digest('hex')
      : undefined;

    const eventData = {
      data: [{
        event_name: 'Schedule',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        user_data: {
          em:  hash(email)  ? [hash(email)]  : undefined,
          ph:  hash(phone)  ? [hash(phone)]  : undefined,
          fn:  hash(name.split(' ')[0]) || undefined,
          ln:  hash(name.split(' ').slice(1).join(' ')) || undefined,
          client_ip_address: req.headers['x-forwarded-for'] || '',
          client_user_agent: req.headers['user-agent'] || '',
        },
        custom_data: {
          appointment_status: 'confirmed',
          source: 'GHL Webhook'
        }
      }]
    };

    const capiRes = await fetch(
      `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      }
    );

    const capiData = await capiRes.json();
    console.log('Meta CAPI Schedule response:', capiData);

    return res.status(200).json({ success: true, capi: capiData });

  } catch (err) {
    console.error('Schedule webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
