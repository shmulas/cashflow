# Income Types (גביה + צפי חשבוניות) Design

**Date:** 2026-05-14
**Status:** Approved

## Goal

Add two new income categories to the cashflow dashboard, each with a distinct chart color, to give a complete picture of incoming money:

| Type | Label | Color | Source |
|---|---|---|---|
| `invoice` | הכנסות | Green `rgba(29,158,117,0.75)` | Monday "Not Paid", future month — already exists |
| `collection` | גביה | Yellow `rgba(234,179,8,0.75)` | Monday "Not Paid", expected month already passed |
| `expected` | צפי חשבוניות | Sky blue `rgba(56,189,248,0.75)` | Manually entered, no invoice yet |

## Database

Single migration, run once in Supabase SQL Editor:

```sql
ALTER TABLE income ADD COLUMN IF NOT EXISTS type text DEFAULT 'invoice';
```

All existing rows receive `type = 'invoice'`. No data loss.

## Monday Sync (`api/monday-sync.js`)

After calculating `month = invoice_date + 60 days`:

```js
const nowYM = toYM(new Date());
const calculated = toYM(addDays(dateStr, 60));
const type = calculated < nowYM ? 'collection' : 'invoice';
const month = calculated < nowYM ? nowYM : calculated;
```

- Past-month invoices → `type = 'collection'`, reassigned to current month
- Future-month invoices → `type = 'invoice'`, month unchanged

The `toInsert` object gains a `type` field alongside existing `monday_id`, `source`, `amount`, `month`, `prob`.

## UI — צפי חשבוניות (`index.html`)

### New form section in הכנסות tab

Below the existing Monday-synced income table, add a card titled "צפי חשבוניות" with:
- Fields: מקור (text), חודש (month select), סכום (number)
- `prob` fixed at 100 (not shown to user)
- `type` fixed at `'expected'`
- Saves to `income` table via existing `db('POST', 'income', ...)` pattern
- Delete button per row (same as existing income rows)

### Income table display

The existing income table (`incomeTbody`) shows all rows from `state.income`. Add a colored type badge per row:

| type | badge |
|---|---|
| `invoice` | ירוק — הכנסה |
| `collection` | צהוב — גביה |
| `expected` | תכלת — צפי |

### `state` and `loadAll`

No changes — `state.income` already holds all income rows. The new `type` field is just present on each row.

## Chart (`index.html`)

`calcMonth(m)` splits income into three subtotals:

```js
const inv  = state.income.filter(i => i.month === m && i.type !== 'collection' && i.type !== 'expected').reduce((s,i) => s + i.amount * (i.prob/100), 0);
const coll = state.income.filter(i => i.month === m && i.type === 'collection').reduce((s,i) => s + i.amount * (i.prob/100), 0);
const exp  = state.income.filter(i => i.month === m && i.type === 'expected').reduce((s,i) => s + i.amount * (i.prob/100), 0);
```

Returns `{ inv, coll, exp, loans, sal, cc, oth, exp_total }`.

Three bar datasets replace the single `הכנסות` dataset, all in `stack: 'inc'`:

```js
{ type:'bar', label:'הכנסות',        data: months.map(m => calcMonth(m).inv),  backgroundColor:'rgba(29,158,117,0.75)',  stack:'inc' },
{ type:'bar', label:'גביה',           data: months.map(m => calcMonth(m).coll), backgroundColor:'rgba(234,179,8,0.75)',   stack:'inc' },
{ type:'bar', label:'צפי חשבוניות',  data: months.map(m => calcMonth(m).exp),  backgroundColor:'rgba(56,189,248,0.75)',  stack:'inc' },
```

Legend gains two new dots (yellow + sky blue).

## KPI Impact

`updateAll()` currently sums `calcMonth(m).inc`. After the change it sums `inv + coll + exp` for `tInc`. Net cashflow and runway calculations use this combined total — no change to KPI logic needed beyond the `calcMonth` return value rename.

## Files Changed

- `index.html` — `calcMonth`, chart datasets, legend, הכנסות tab UI
- `api/monday-sync.js` — add `type` field to `toInsert` rows
- Supabase — one-time SQL migration (manual)
