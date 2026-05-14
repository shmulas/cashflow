const BOARD_ID = 3416125388;

async function gql(query) {
  const r = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MONDAY_API_KEY}`,
      'Content-Type': 'application/json',
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`Monday API ${r.status}: ${await r.text()}`);
  const json = await r.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d;
}

function toYM(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const data = await gql(`{
      boards(ids: [${BOARD_ID}]) {
        items_page(limit: 500) {
          items {
            id
            name
            column_values {
              title
              text
              value
            }
          }
        }
      }
    }`);

    const items = data.boards[0].items_page.items;
    const toUpsert = [];

    for (const item of items) {
      const col = {};
      item.column_values.forEach(c => { col[c.title] = c; });

      // Filter: only "not paid"
      const status = (col['סטטוס']?.text || col['Status']?.text || '').toLowerCase();
      if (!status.includes('not paid')) continue;

      // Amount: "תשלום כולל מעמ"
      const amountRaw = col['תשלום כולל מעמ']?.text || '';
      const amount = parseFloat(amountRaw.replace(/[^\d.]/g, ''));
      if (!amount) continue;

      // Date: "תאריך רישום חשבונית" + 60 days → month
      let dateStr = null;
      const dateCol = col['תאריך רישום חשבונית'];
      if (dateCol?.value) {
        try { dateStr = JSON.parse(dateCol.value).date; } catch {}
      }
      if (!dateStr && dateCol?.text) dateStr = dateCol.text;
      if (!dateStr) continue;

      const payDate = addDays(dateStr, 60);
      const month = toYM(payDate);

      toUpsert.push({
        monday_id: String(item.id),
        source: item.name,
        amount,
        month,
        prob: 100,
      });
    }

    if (!toUpsert.length) return res.json({ synced: 0, message: 'אין פריטים עם סטטוס not paid' });

    // Upsert to Supabase (merge by monday_id)
    const sb = await fetch(`${process.env.SUPABASE_URL}/income`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(toUpsert),
    });

    if (!sb.ok) throw new Error(await sb.text());
    const rows = await sb.json();
    res.json({ synced: rows.length, items: rows.map(r => ({ source: r.source, amount: r.amount, month: r.month })) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
