export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { date, state } = req.query;

  const GHL_API_KEY = process.env.GHL_API_KEY;
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
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

  // Full day range in milliseconds — use local midnight to midnight
  const [y, m, d] = date.split('-').map(Number);
  // Use UTC midnight to avoid timezone issues
  const startMs = Date.UTC(y, m - 1, d, 0, 0, 0);
  const endMs   = Date.UTC(y, m - 1, d, 23, 59, 59);

  try {
    const r = await fetch(
      `https://services.leadconnectorhq.com/calendars/events?calendarId=${calendarId}&startTime=${startMs}&endTime=${endMs}&locationId=${GHL_LOCATION_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-07-28'
        }
      }
    );
    const data = await r.json();
    const events = data?.events || [];

    // Convert each booked startTime to "H:MM AM/PM" format in Eastern time
    // GHL stores times in UTC — convert to Eastern (UTC-4 EDT / UTC-5 EST)
    const booked = events.map(ev => {
      const utcMs = new Date(ev.startTime).getTime();
      // Detect EST vs EDT: March 8 – Nov 1 = EDT (UTC-4), otherwise EST (UTC-5)
      const dt = new Date(utcMs);
      const month = dt.getUTCMonth() + 1;
      const day = dt.getUTCDate();
      const isEDT = (month > 3 || (month === 3 && day >= 8)) &&
                    (month < 11 || (month === 11 && day < 1));
      const offsetHours = isEDT ? -4 : -5;
      const localMs = utcMs + offsetHours * 60 * 60 * 1000;
      const localDt = new Date(localMs);
      let h = localDt.getUTCHours();
      const min = localDt.getUTCMinutes();
      const meridiem = h >= 12 ? 'PM' : 'AM';
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      const minStr = min === 0 ? '00' : String(min).padStart(2, '0');
      return `${h}:${minStr} ${meridiem}`;
    });

    console.log('Date:', date, 'State:', state, 'Booked slots:', booked);
    return res.status(200).json({ booked });
  } catch (err) {
    console.error('Availability error:', err);
    return res.status(500).json({ booked: [] });
  }
}
