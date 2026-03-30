export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers — allow your Vercel domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { fname, lname, phone, email, address, date, slot, waterType, symptoms } = req.body;

  const GHL_API_KEY     = process.env.GHL_API_KEY;
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

  const GHL_CALENDARS = {
    SC: 'Cbn1dBt36MFjunNKpMMJ',
    NC: 'DBelueY6yDL7ZRSEN72i',
    VA: '9hAPlJXoqofSUZMVjSrZ',
    MD: 'BkkPtJ3mVP7YirEdSzHx'
  };

  // Detect state from last segment of address
  function detectState(addr) {
    const parts = addr.split(',').map(s => s.trim());
    return parts[parts.length - 1].toUpperCase();
  }

  // Convert date + slot to ISO timestamps
  function buildSlotISO(dateStr, slotStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [time, mer] = slotStr.split(' ');
    let [h, min] = time.split(':').map(Number);
    if (mer === 'PM' && h !== 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    const start = new Date(y, m - 1, d, h, min, 0);
    const end   = new Date(y, m - 1, d, h + 1, min, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  async function ghlPost(endpoint, body) {
    const r = await fetch('https://services.leadconnectorhq.com' + endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify(body)
    });
    return r.json();
  }

  try {
    const state      = detectState(address);
    const calendarId = GHL_CALENDARS[state];
    const { start, end } = buildSlotISO(date, slot);

    // 1 — Create contact
    const contactRes = await ghlPost('/contacts/', {
      locationId:   GHL_LOCATION_ID,
      firstName:    fname,
      lastName:     lname,
      phone:        '+1' + phone,
      email:        email,
      address1:     address,
      source:       'Landing Page Aquafeel',
      tags:         [state, 'Landing Aquafeel', 'Inspeccion Solicitada'],
      customFields: [
        { key: 'homeowner',  field_value: 'Yes'       },
        { key: 'language',   field_value: 'Spanish'   },
        { key: 'water_type', field_value: waterType   },
        { key: 'symptoms',   field_value: symptoms    }
      ]
    });

    const contactId = contactRes?.contact?.id;

    // 2 — Create appointment in the correct state calendar
    if (contactId && calendarId) {
      await ghlPost('/calendars/events/appointments', {
        calendarId:        calendarId,
        locationId:        GHL_LOCATION_ID,
        contactId:         contactId,
        startTime:         start,
        endTime:           end,
        title:             `Inspeccion Aquafeel — ${fname} ${lname}`,
        appointmentStatus: 'new',
        address:           address,
        notes:             `Estado: ${state} | Agua: ${waterType} | Sintomas: ${symptoms}`
      });
    }

    return res.status(200).json({ success: true, contactId, state });

  } catch (err) {
    console.error('GHL Error:', err);
    return res.status(500).json({ error: 'Internal error', details: err.message });
  }
}
