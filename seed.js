const BASE = 'https://gjakzsaosjcfforcjdlj.supabase.co/rest/v1';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqYWt6c2Fvc2pjZmZvcmNqZGxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NTk4MjQsImV4cCI6MjA5NDIzNTgyNH0.-QeKeh9dtZkCZFBXOBNbylmuNJOSkbTN8KgySUGYays';

const loans = [
  { bank:'בינלאומי', name:'הלו. שונות 604',      principal:150000, balance:91147,  payment:6860,   rate:12.5, start_month:'2025-06', end_month:'2027-06', balloon:false },
  { bank:'בינלאומי', name:'הלו. שונות 1007',     principal:188000, balance:188603, payment:188603, rate:12.5, start_month:'2026-05', end_month:'2026-05', balloon:true  },
  { bank:'בינלאומי', name:'ערבות מדינה 108',     principal:150000, balance:10506,  payment:3540,   rate:8.5,  start_month:'2021-08', end_month:'2026-08', balloon:false },
  { bank:'פועלים',   name:'הלוואה בהטבה 32',     principal:100000, balance:100499, payment:100534, rate:9,    start_month:'2026-05', end_month:'2026-05', balloon:true  },
  { bank:'פועלים',   name:'לא צמוד 11',          principal:200000, balance:94451,  payment:4095,   rate:9,    start_month:'2023-06', end_month:'2028-06', balloon:false },
  { bank:'פועלים',   name:'לא צמוד 31',          principal:250000, balance:250667, payment:126151, rate:9,    start_month:'2026-05', end_month:'2026-05', balloon:true  },
  { bank:'פועלים',   name:'לא צמוד 33',          principal:70000,  balance:70408,  payment:70437,  rate:9,    start_month:'2026-05', end_month:'2026-05', balloon:true  },
  { bank:'פועלים',   name:'מבצע אשראי 30',       principal:228409, balance:220331, payment:3475,   rate:9,    start_month:'2025-12', end_month:'2032-11', balloon:false },
  { bank:'פועלים',   name:'אשראי מיידי 8',       principal:350000, balance:90956,  payment:6913,   rate:9,    start_month:'2022-06', end_month:'2027-06', balloon:false },
  { bank:'פועלים',   name:'אשראי מיידי 18',      principal:165900, balance:136664, payment:2705,   rate:9,    start_month:'2024-05', end_month:'2031-05', balloon:false },
  { bank:'פועלים',   name:'אשראי מיידי 28',      principal:34500,  balance:31222,  payment:701,    rate:9,    start_month:'2025-10', end_month:'2030-10', balloon:false },
  { bank:'לאומי',    name:'369924',              principal:55000,  balance:41869,  payment:1110,   rate:8.2,  start_month:'2024-10', end_month:'2029-11', balloon:false },
  { bank:'לאומי',    name:'366314',              principal:100000, balance:80835,  payment:4494,   rate:7.5,  start_month:'2025-06', end_month:'2027-11', balloon:false },
  { bank:'לאומי',    name:'369916',              principal:180000, balance:128484, payment:3723,   rate:8.2,  start_month:'2024-08', end_month:'2029-09', balloon:false },
];

async function seed() {
  const res = await fetch(`${BASE}/loans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': KEY,
      'Authorization': 'Bearer ' + KEY,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(loans),
  });
  const text = await res.text();
  if (!res.ok) { console.error('Error:', text); process.exit(1); }
  const rows = JSON.parse(text);
  console.log(`✓ נוספו ${rows.length} הלוואות`);
  rows.forEach(r => console.log(`  [${r.id}] ${r.bank} — ${r.name} — יתרה: ₪${r.balance.toLocaleString()}`));
}

seed();
