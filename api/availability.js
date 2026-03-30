export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { date, state } = req.query;

  const GHL_API_KEY = process.env.GHL_API_KEY;
  const GHL_CALENDARS = {
    SC: 'Cbn1dBt36MFjunNKpMMJ',
    NC: 'DBelueY6yDL7ZRSEN72i',
    VA: '9hAPlJXoqofSUZMVjSrZ',
    MD: 'BkkPtJ3mVP7YirEdSzHx'
  };

  const calendarId = GHL_CALENDARS[state?.toUpperCase()];
  if (!calendarId || !date) {
    return res.status(400).json({ error: 'Missing date or state' });
  }

  // Build day range in UTC (full day)
  const [y, m, d] = date.split('-').map(Number);
  const startMs = new Date(y, m - 1, d, 0, 0, 0).getTime();
  const endMs   = new Date(y, m - 1, d, 23, 59, 59).getTime();

  try {
    const r = await fetch(
      `https://services.leadconnectorhq.com/calendars/events?calendarId=${calendarId}&startTime=${startMs}&endTime=${endMs}&locationId=${process.env.GHL_LOCATION_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-07-28'
        }
      }
    );
    const data = await r.json();
    const events = data?.events || [];

    // Extract booked start times as "H:MM AM/PM" strings
    const booked = events.map(ev => {
      const dt = new Date(ev.startTime);
      return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    });

    return res.status(200).json({ booked });
  } catch (err) {
    console.error('Availability error:', err);
    return res.status(500).json({ booked: [] }); // fail open — show all slots
  }
}
