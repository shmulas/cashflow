const BOARD_ID = 3416125388;
const SUPABASE_URL = () => process.env.SUPABASE_URL;
const SUPABASE_KEY = () => process.env.SUPABASE_ANON_KEY;

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

async function runSync() {
  const data = await gql(`{
    boards(ids: [${BOARD_ID}]) {
      columns { id title }
      items_page(limit: 500) {
        items {
          id
          name
          column_values {
            id
            text
            value
            ... on MirrorValue {
              display_value
            }
          }
        }
      }
    }
  }`);

  const board = data.boards[0];
  const idToTitle = {};
  board.columns.forEach(c => { idToTitle[c.id] = c.title; });

  const items = board.items_page.items;
  const toInsert = [];

  const skipped = [];
  for (const item of items) {
    const col = {};
    item.column_values.forEach(c => { col[idToTitle[c.id]] = c; });

    // Filter: only "Not Paid"
    const status = (col['Status']?.text || '').toLowerCase();
    if (!status.includes('not paid')) { skipped.push({ name: item.name, reason: 'status: ' + (col['Status']?.text || 'empty') }); continue; }

    // Amount: "סה"כ חשבונית" × 1.18
    const baseAmount = parseFloat((col['סה"כ חשבונית']?.text || '').replace(/[^\d.]/g, ''));
    if (!baseAmount) { skipped.push({ name: item.name, reason: 'no amount' }); continue; }
    const amount = Math.round(baseAmount * 1.18);

    // Date: "רישום חשבונית" + 60 days → month
    let dateStr = null;
    const dateCol = col['רישום חשבונית'];
    if (dateCol?.value) {
      try { dateStr = JSON.parse(dateCol.value).date; } catch {}
    }
    if (!dateStr && dateCol?.text) dateStr = dateCol.text;
    if (!dateStr) { skipped.push({ name: item.name, reason: 'no date', amount }); continue; }

    const nowYM = toYM(new Date());
    const payDay = addDays(dateStr, 60);
    const calculated = toYM(payDay);
    const type = calculated < nowYM ? 'collection' : 'invoice';
    const month = calculated < nowYM ? nowYM : calculated;
    const date = `${payDay.getFullYear()}-${String(payDay.getMonth()+1).padStart(2,'0')}-${String(payDay.getDate()).padStart(2,'0')}`;
    const company = col['חברה']?.display_value || col['חברה']?.text || null;
    const source = company ? `${company} (${item.name})` : item.name;

    toInsert.push({ monday_id: String(item.id), source, amount, month, prob: 100, type, date });
  }

  // Step 1: delete all existing Monday rows
  const del = await fetch(`${SUPABASE_URL()}/income?monday_id=not.is.null`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_KEY(),
      Authorization: `Bearer ${SUPABASE_KEY()}`,
    },
  });
  if (!del.ok) throw new Error(`Delete failed: ${await del.text()}`);

  if (!toInsert.length) return { synced: 0, message: 'אין פריטים עם סטטוס Not Paid וסכום', total_items: items.length, skipped };

  // Step 2: insert fresh rows
  const ins = await fetch(`${SUPABASE_URL()}/income`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY(),
      Authorization: `Bearer ${SUPABASE_KEY()}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(toInsert),
  });
  if (!ins.ok) throw new Error(await ins.text());
  const rows = await ins.json();
  return { synced: rows.length, skipped, items: rows.map(r => ({ source: r.source, amount: r.amount, month: r.month, type: r.type })) };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const result = await runSync();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
