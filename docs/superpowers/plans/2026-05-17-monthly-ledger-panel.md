# Monthly Ledger Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Click any month bar in the chart → side panel slides in from the right showing a bank-statement-style ledger (עובר ושב) with all income and expenses for that month, running balance per row, starting from current bank total.

**Architecture:** Add a `date` column to the `income` table so Monday-synced rows store their precise payment date (invoice date + 60 days as YYYY-MM-DD). `buildLedger(m, openingBal)` assembles all transactions for a month from `state.*`, sorts by date, and computes running balance. `openMonthPanel(m, openingBal)` renders the panel. Chart.js `onClick` triggers it. Opening balance per month comes from `_balData[idx]` (module-level copy of the existing balance array).

**Tech Stack:** Vanilla JS, Chart.js 4.4.1, Supabase REST, Vercel Node serverless

---

## File Map

| File | Change |
|---|---|
| Supabase SQL Editor | One-time: `ALTER TABLE income ADD COLUMN IF NOT EXISTS date date;` |
| `api/monday-sync.js` | Add `date` field (invoice date + 60 days as YYYY-MM-DD) to each inserted row |
| `index.html` | Module-level `_months`/`_balData`, panel CSS, panel HTML, `buildLedger`, `openMonthPanel`, chart `onClick` |

---

## Task 1: DB Migration

**Files:**
- Supabase SQL Editor (manual, one-time)

- [ ] **Step 1: Run migration in Supabase SQL Editor**

  ```sql
  ALTER TABLE income ADD COLUMN IF NOT EXISTS date date;
  ```

  Expected: "Success. No rows affected." Existing rows get `date = null` — the panel falls back to day 01 of their month for those rows.

- [ ] **Step 2: Verify column exists**

  ```sql
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'income' AND column_name = 'date';
  ```

  Expected: one row returned with `data_type = date`.

---

## Task 2: Monday Sync — store precise payment date

**Files:**
- Modify: `api/monday-sync.js` lines 82–89

- [ ] **Step 1: Replace the date+type block to also compute the ISO date**

  Find (lines 82–89):
  ```js
  const nowYM = toYM(new Date());
  const calculated = toYM(addDays(dateStr, 60));
  const type = calculated < nowYM ? 'collection' : 'invoice';
  const month = calculated < nowYM ? nowYM : calculated;
  const company = col['חברה']?.display_value || col['חברה']?.text || null;
  const source = company ? `${company} (${item.name})` : item.name;

  toInsert.push({ monday_id: String(item.id), source, amount, month, prob: 100, type });
  ```

  Replace with:
  ```js
  const nowYM = toYM(new Date());
  const payDay = addDays(dateStr, 60);
  const calculated = toYM(payDay);
  const type = calculated < nowYM ? 'collection' : 'invoice';
  const month = calculated < nowYM ? nowYM : calculated;
  const date = `${payDay.getFullYear()}-${String(payDay.getMonth()+1).padStart(2,'0')}-${String(payDay.getDate()).padStart(2,'0')}`;
  const company = col['חברה']?.display_value || col['חברה']?.text || null;
  const source = company ? `${company} (${item.name})` : item.name;

  toInsert.push({ monday_id: String(item.id), source, amount, month, prob: 100, type, date });
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add api/monday-sync.js
  git commit -m "feat: monday sync stores precise payment date per row"
  ```

---

## Task 3: Panel CSS + HTML

**Files:**
- Modify: `index.html` — style block and body (before `</body>`)

- [ ] **Step 1: Add panel CSS**

  Find:
  ```css
  .header-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem}
  .header-row h1{margin-bottom:0}
  ```

  Replace with:
  ```css
  .header-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem}
  .header-row h1{margin-bottom:0}
  .month-panel{position:fixed;top:0;right:-440px;width:440px;height:100vh;background:#fff;box-shadow:-4px 0 24px rgba(0,0,0,.13);z-index:900;transition:right .28s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;overflow:hidden}
  .month-panel.open{right:0}
  .month-panel-header{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;border-bottom:1px solid #e0e0e0;font-weight:500;font-size:15px;background:#fff;flex-shrink:0}
  .month-panel-body{flex:1;overflow-y:auto}
  .ledger-row{display:grid;grid-template-columns:64px 1fr 85px 90px;gap:6px;padding:7px 1.25rem;border-bottom:0.5px solid #f0f0f0;font-size:12px;align-items:center}
  .ledger-header{font-size:11px;color:#666;font-weight:500;background:#f8f8f6;position:sticky;top:0;z-index:1}
  .ledger-bal-row{background:#f0fdf4;font-weight:500}
  .ledger-num{text-align:left;direction:ltr}
  .panel-overlay{display:none;position:fixed;inset:0;z-index:899}
  .panel-overlay.open{display:block}
  ```

- [ ] **Step 2: Add panel HTML just before `</body>`**

  Find (just before the edit-loan modal):
  ```html
  <!-- Edit Loan Modal -->
  ```

  Insert before it:
  ```html
  <!-- Month Detail Panel -->
  <div class="panel-overlay" id="panelOverlay" onclick="closeMonthPanel()"></div>
  <div id="monthPanel" class="month-panel">
    <div class="month-panel-header">
      <span id="monthPanelTitle"></span>
      <button onclick="closeMonthPanel()" style="background:none;border:none;cursor:pointer;color:#666;font-size:20px;line-height:1"><i class="ti ti-x"></i></button>
    </div>
    <div id="monthPanelBody" class="month-panel-body"></div>
  </div>
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add index.html
  git commit -m "feat: add month ledger panel CSS and HTML"
  ```

---

## Task 4: Panel JS — logic + chart click handler

**Files:**
- Modify: `index.html` — script section

- [ ] **Step 1: Lift `_months` and `_balData` to module scope**

  Find:
  ```js
  let mainChart=null;
  ```

  Replace with:
  ```js
  let mainChart=null;
  let _months=[],_balData=[];
  ```

- [ ] **Step 2: Save to module scope inside `updateAll`**

  Find inside `updateAll`:
  ```js
  const balData=[];let runBal=bankTotal;
  months.forEach(m=>{balData.push(runBal);runBal+=calcMonth(m).net;});
  ```

  Replace with:
  ```js
  const balData=[];let runBal=bankTotal;
  months.forEach(m=>{balData.push(runBal);runBal+=calcMonth(m).net;});
  _months=months;_balData=[...balData];
  ```

- [ ] **Step 3: Add chart `onClick` handler**

  Find in the chart `options` block:
  ```js
  options:{responsive:true,maintainAspectRatio:false,
  ```

  Replace with:
  ```js
  options:{responsive:true,maintainAspectRatio:false,
    onClick:(evt,elements)=>{if(!elements.length)return;const idx=elements[0].index;openMonthPanel(_months[idx],_balData[idx]);},
  ```

- [ ] **Step 4: Add `buildLedger`, `openMonthPanel`, `closeMonthPanel` functions**

  Find:
  ```js
  function renderLoans(){
  ```

  Insert immediately before it:
  ```js
  function buildLedger(m, openingBal){
    const entries=[];
    state.income.filter(i=>i.month===m).forEach(i=>{
      entries.push({date:i.date||`${m}-01`,label:i.source,amount:Math.round(i.amount*(i.prob/100)),dir:1});
    });
    state.salary.filter(s=>s.month===m).forEach(s=>{
      entries.push({date:`${m}-01`,label:'שכר'+(s.notes?` – ${s.notes}`:''),amount:s.amount,dir:-1});
    });
    state.cc.filter(c=>c.month===m).forEach(c=>{
      entries.push({date:`${m}-01`,label:`אשראי – ${c.name}`,amount:c.amount,dir:-1});
    });
    state.other.filter(o=>o.month===m).forEach(o=>{
      entries.push({date:`${m}-01`,label:o.category,amount:o.amount,dir:-1});
    });
    state.loans.forEach(l=>{
      if(loanPmt(l,m)<=0)return;
      const day=l.start&&l.start.length===10?l.start.substring(8):'01';
      entries.push({date:`${m}-${day}`,label:`הלוואה – ${l.name}`,amount:l.payment,dir:-1});
    });
    entries.sort((a,b)=>a.date.localeCompare(b.date));
    let bal=openingBal;
    return entries.map(e=>{bal+=e.dir*e.amount;return{...e,balance:bal};});
  }

  function openMonthPanel(m, openingBal){
    const [y,mo]=m.split('-');
    const title=new Date(+y,+mo-1).toLocaleString('he',{month:'long',year:'numeric'});
    document.getElementById('monthPanelTitle').textContent=title;
    const entries=buildLedger(m,openingBal);
    const closingBal=entries.length?entries[entries.length-1].balance:openingBal;
    const fmtBal=v=>(v<0?'-':'')+fmt(v);
    const balColor=v=>v>=0?'#1D9E75':'#E24B4A';
    document.getElementById('monthPanelBody').innerHTML=`
      <div class="ledger-row ledger-header"><span>תאריך</span><span>תיאור</span><span class="ledger-num">תנועה</span><span class="ledger-num">יתרה</span></div>
      <div class="ledger-row ledger-bal-row"><span></span><span>יתרת פתיחה</span><span></span><span class="ledger-num">${fmtBal(openingBal)}</span></div>
      ${entries.map(e=>`<div class="ledger-row">
        <span>${fmtDate(e.date)}</span>
        <span style="overflow:hidden;text-overflow:ellipsis">${e.label}</span>
        <span class="ledger-num" style="color:${e.dir===1?'#1D9E75':'#E24B4A'}">${e.dir===1?'+':'-'}${fmt(e.amount)}</span>
        <span class="ledger-num" style="font-weight:500;color:${balColor(e.balance)}">${fmtBal(e.balance)}</span>
      </div>`).join('')}
      <div class="ledger-row ledger-bal-row"><span></span><span>יתרת סגירה</span><span></span><span class="ledger-num" style="color:${balColor(closingBal)}">${fmtBal(closingBal)}</span></div>
    `;
    document.getElementById('monthPanel').classList.add('open');
    document.getElementById('panelOverlay').classList.add('open');
  }

  function closeMonthPanel(){
    document.getElementById('monthPanel').classList.remove('open');
    document.getElementById('panelOverlay').classList.remove('open');
  }

  ```

- [ ] **Step 5: Add Escape key listener (inside the `_auth.onAuthStateChanged` success block, near the bottom of the script — find the end of `loadAll` call)**

  Find:
  ```js
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('editLoanModal').classList.remove('open');});
  ```

  If that line exists, replace with:
  ```js
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.getElementById('editLoanModal').classList.remove('open');closeMonthPanel();}});
  ```

  If it does NOT exist, find:
  ```js
  ['salMonth','ccMonth','incMonth','otherMonth','forecastMonth'].forEach(buildMonthOptions);
  ```

  And add immediately after it:
  ```js
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.getElementById('editLoanModal').classList.remove('open');closeMonthPanel();}});
  ```

- [ ] **Step 6: Commit and push**

  ```bash
  git add index.html
  git commit -m "feat: monthly ledger side panel with running balance"
  git push
  ```

---

## Task 5: Sync Monday to populate `date` field

- [ ] **Step 1: Click "סנכרן Monday" in the dashboard**

  This re-runs the sync. Each income row now gets a `date` field (precise payment date).

- [ ] **Step 2: Verify in Supabase**

  In Supabase Table Editor → `income` table → check that `date` column is populated for Monday-synced rows (non-null for rows with `monday_id`).

---

## Task 6: Manual Verification

- [ ] **Test 1 — Click a month bar**

  Click any bar in the chart (income or expense bar). Panel slides in from the right showing that month's transactions sorted by date.

- [ ] **Test 2 — Verify running balance**

  Opening balance should match the "יתרה" line chart value for that month. Each row adds/subtracts from balance. Closing balance = opening + net for that month.

- [ ] **Test 3 — Income dates are precise**

  After syncing Monday, hover-check income rows in the panel — they should show the exact DD/MM/YYYY payment date (not 01/MM/YYYY).

- [ ] **Test 4 — Close panel**

  Click ✕ button, click the overlay behind the panel, or press Escape — panel slides out.

- [ ] **Test 5 — Empty month**

  Click a month that has no data. Panel shows only opening/closing balance rows (equal), no transaction rows.
