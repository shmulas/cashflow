# Income Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add גביה (yellow) and צפי חשבוניות (sky blue) income categories alongside existing הכנסות (green), each shown as a distinct bar in the chart.

**Architecture:** Single `type` column on the existing `income` table (already migrated). Monday sync sets `type` based on whether the expected month is past or future. A new manual form adds `type='expected'` entries. `calcMonth()` splits income into three subtotals used by three separate chart datasets.

**Tech Stack:** Vanilla JS, Chart.js 4.4.1, Supabase REST, Vercel Node serverless

---

## File Map

| File | Change |
|---|---|
| `api/monday-sync.js` | Add `type` field to inserted rows |
| `index.html` | `calcMonth`, chart datasets, legend, income UI, new forecast form |

---

## Task 1: Monday Sync — set `type` per row

**Files:**
- Modify: `api/monday-sync.js`

- [ ] **Step 1: Add type logic after month calculation**

  In `api/monday-sync.js`, find this line (around line 81):
  ```js
  const month = toYM(addDays(dateStr, 60));
  ```

  Replace it with:
  ```js
  const nowYM = toYM(new Date());
  const calculated = toYM(addDays(dateStr, 60));
  const type = calculated < nowYM ? 'collection' : 'invoice';
  const month = calculated < nowYM ? nowYM : calculated;
  ```

- [ ] **Step 2: Add `type` to the inserted object**

  Find:
  ```js
  toInsert.push({ monday_id: String(item.id), source, amount, month, prob: 100 });
  ```

  Replace with:
  ```js
  toInsert.push({ monday_id: String(item.id), source, amount, month, prob: 100, type });
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add api/monday-sync.js
  git commit -m "feat: monday sync sets type=collection for past-month invoices"
  ```

---

## Task 2: Split `calcMonth` into three income subtotals

**Files:**
- Modify: `index.html` — `calcMonth` function (around line 325)

- [ ] **Step 1: Replace `calcMonth`**

  Find the entire `calcMonth` function:
  ```js
  function calcMonth(m){
    const inc=state.income.filter(i=>i.month===m).reduce((s,i)=>s+i.amount*(i.prob/100),0);
    const loans=state.loans.reduce((s,l)=>s+loanPmt(l,m),0);
    const sal=state.salary.filter(s=>s.month===m).reduce((s,i)=>s+i.amount,0);
    const cc=state.cc.filter(c=>c.month===m).reduce((s,i)=>s+i.amount,0);
    const oth=state.other.filter(o=>o.month===m).reduce((s,i)=>s+i.amount,0);
    const exp=loans+sal+cc+oth;
    return{inc,loans,sal,cc,oth,exp,net:inc-exp};
  }
  ```

  Replace with:
  ```js
  function calcMonth(m){
    const inv=state.income.filter(i=>i.month===m&&(!i.type||i.type==='invoice')).reduce((s,i)=>s+i.amount*(i.prob/100),0);
    const coll=state.income.filter(i=>i.month===m&&i.type==='collection').reduce((s,i)=>s+i.amount*(i.prob/100),0);
    const forecast=state.income.filter(i=>i.month===m&&i.type==='expected').reduce((s,i)=>s+i.amount*(i.prob/100),0);
    const inc=inv+coll+forecast;
    const loans=state.loans.reduce((s,l)=>s+loanPmt(l,m),0);
    const sal=state.salary.filter(s=>s.month===m).reduce((s,i)=>s+i.amount,0);
    const cc=state.cc.filter(c=>c.month===m).reduce((s,i)=>s+i.amount,0);
    const oth=state.other.filter(o=>o.month===m).reduce((s,i)=>s+i.amount,0);
    const exp=loans+sal+cc+oth;
    return{inv,coll,forecast,inc,loans,sal,cc,oth,exp,net:inc-exp};
  }
  ```

  > Note: `(!i.type||i.type==='invoice')` handles rows inserted before the migration that may have `type=null`.

- [ ] **Step 2: Commit**

  ```bash
  git add index.html
  git commit -m "feat: calcMonth splits income into inv/coll/forecast subtotals"
  ```

---

## Task 3: Update chart datasets and legend

**Files:**
- Modify: `index.html` — chart datasets (around line 359) and legend (lines 111–117)

- [ ] **Step 1: Replace the single income dataset with three**

  Find:
  ```js
  {type:'bar',label:'הכנסות',data:months.map(m=>calcMonth(m).inc),backgroundColor:'rgba(29,158,117,0.75)',borderWidth:0,stack:'inc'},
  ```

  Replace with:
  ```js
  {type:'bar',label:'הכנסות',      data:months.map(m=>calcMonth(m).inv),     backgroundColor:'rgba(29,158,117,0.75)', borderWidth:0,stack:'inc'},
  {type:'bar',label:'גביה',         data:months.map(m=>calcMonth(m).coll),    backgroundColor:'rgba(234,179,8,0.75)',  borderWidth:0,stack:'inc'},
  {type:'bar',label:'צפי חשבוניות',data:months.map(m=>calcMonth(m).forecast),backgroundColor:'rgba(56,189,248,0.75)', borderWidth:0,stack:'inc'},
  ```

- [ ] **Step 2: Add two legend dots**

  Find:
  ```html
  <span><span class="leg-dot" style="background:#1D9E75"></span>הכנסות</span>
  ```

  Replace with:
  ```html
  <span><span class="leg-dot" style="background:#1D9E75"></span>הכנסות</span>
  <span><span class="leg-dot" style="background:#EAB308"></span>גביה</span>
  <span><span class="leg-dot" style="background:#38BDF8"></span>צפי חשבוניות</span>
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add index.html
  git commit -m "feat: chart shows גביה (yellow) and צפי חשבוניות (sky blue) bars"
  ```

---

## Task 4: Income table — add type badge

**Files:**
- Modify: `index.html` — `renderIncome` function (around line 413) and income table header (line 183)

- [ ] **Step 1: Add `typeBadge` helper before `renderIncome`**

  Find:
  ```js
  function renderIncome(){
  ```

  Add immediately before it:
  ```js
  function typeBadge(type){
    if(type==='collection') return '<span style="background:#FEF9C3;color:#854D0E;border-radius:4px;padding:1px 6px;font-size:10px">גביה</span>';
    if(type==='expected')   return '<span style="background:#E0F2FE;color:#0369A1;border-radius:4px;padding:1px 6px;font-size:10px">צפי</span>';
    return '<span style="background:#DCFCE7;color:#166534;border-radius:4px;padding:1px 6px;font-size:10px">חשבונית</span>';
  }
  ```

- [ ] **Step 2: Update `renderIncome` to include type badge**

  Find:
  ```js
  tb.innerHTML=state.income.length?state.income.map(i=>`<tr><td>${i.source}</td><td>${i.month}</td><td>${fmt(i.amount)}</td><td>${i.prob}%</td><td>${fmt(i.amount*i.prob/100)}</td><td><button class="danger" onclick="removeIncome(${i.id})"><i class="ti ti-trash"></i></button></td></tr>`).join(''):'<tr><td colspan="6" class="empty">אין הכנסות עדיין</td></tr>';
  ```

  Replace with:
  ```js
  tb.innerHTML=state.income.length?state.income.map(i=>`<tr><td>${typeBadge(i.type)}</td><td>${i.source}</td><td>${i.month}</td><td>${fmt(i.amount)}</td><td>${i.prob}%</td><td>${fmt(i.amount*i.prob/100)}</td><td><button class="danger" onclick="removeIncome(${i.id})"><i class="ti ti-trash"></i></button></td></tr>`).join(''):'<tr><td colspan="7" class="empty">אין הכנסות עדיין</td></tr>';
  ```

- [ ] **Step 3: Add "סוג" column header to income table**

  Find:
  ```html
  <thead><tr><th>מקור</th><th>חודש</th><th>סכום</th><th>%</th><th>משוקלל</th><th></th></tr></thead>
  ```

  Replace with:
  ```html
  <thead><tr><th>סוג</th><th>מקור</th><th>חודש</th><th>סכום</th><th>%</th><th>משוקלל</th><th></th></tr></thead>
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add index.html
  git commit -m "feat: income table shows type badge per row"
  ```

---

## Task 5: Add צפי חשבוניות form

**Files:**
- Modify: `index.html` — הכנסות tab HTML (around line 186) and script section

- [ ] **Step 1: Add new card in הכנסות tab**

  Find:
  ```html
  </div>
  </div>

  <!-- EXPENSES -->
  ```

  Replace with:
  ```html
  </div>
  <div class="card">
    <div class="card-title"><i class="ti ti-clock-dollar" aria-hidden="true"></i> צפי חשבוניות</div>
    <div class="form-grid">
      <div><div class="form-label">מקור / לקוח</div><input type="text" id="forecastSource"></div>
      <div><div class="form-label">סכום (₪)</div><input type="number" id="forecastAmount"></div>
      <div><div class="form-label">חודש</div><select id="forecastMonth"></select></div>
    </div>
    <button class="primary" onclick="addForecast()"><i class="ti ti-plus" aria-hidden="true"></i> הוסף צפי</button>
  </div>
  </div>

  <!-- EXPENSES -->
  ```

- [ ] **Step 2: Add `addForecast` function**

  Find:
  ```js
  async function removeIncome(id){
  ```

  Add immediately before it:
  ```js
  async function addForecast(){
    const source=document.getElementById('forecastSource').value.trim();
    const amount=parseFloat(document.getElementById('forecastAmount').value);
    const month=document.getElementById('forecastMonth').value;
    if(!source||!amount||!month)return alert('מלא שדות חובה');
    try{
      const row=await db('POST','income',{source,amount,month,prob:100,type:'expected'});
      state.income.push(Array.isArray(row)?row[0]:row);
      renderIncome();updateAll();toast('צפי נוסף');
      document.getElementById('forecastSource').value='';
      document.getElementById('forecastAmount').value='';
    }catch(e){alert('שגיאה: '+e.message);}
  }
  ```

- [ ] **Step 3: Register `forecastMonth` in `buildMonthOptions`**

  In the Firebase `onAuthStateChanged` success block, find:
  ```js
  ['salMonth','ccMonth','incMonth','otherMonth'].forEach(buildMonthOptions);
  ```

  Replace with:
  ```js
  ['salMonth','ccMonth','incMonth','otherMonth','forecastMonth'].forEach(buildMonthOptions);
  ```

- [ ] **Step 4: Commit and push**

  ```bash
  git add index.html
  git commit -m "feat: add צפי חשבוניות manual form"
  git push
  ```

---

## Task 6: Manual verification

- [ ] **Test 1 — גביה after sync**

  Click "סנכרן Monday". Open הכנסות tab. Invoices whose date+60 days is before today should show a yellow "גביה" badge and be in the current month. Invoices with future months show green "חשבונית" badge.

- [ ] **Test 2 — גביה in chart**

  Open Overview tab. Chart should show a yellow bar segment in the current month column (inside the `inc` stack) for collection items.

- [ ] **Test 3 — Add צפי חשבוניות**

  In הכנסות tab, fill in the "צפי חשבוניות" form: source=`לקוח X`, amount=`50000`, month=current. Click "הוסף צפי". Row appears with sky blue "צפי" badge. Chart gains a sky blue segment. KPI "הכנסות צפויות" increases.

- [ ] **Test 4 — Delete צפי**

  Click trash on the new row. Row disappears, chart and KPI update.

- [ ] **Test 5 — Manual income unaffected**

  Add an income via the original "הוסף ידנית" form. It gets a green "חשבונית" badge. Sync does not delete it (it has no `monday_id`).
