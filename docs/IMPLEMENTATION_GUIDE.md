# Financial Budget Table — Implementation Guide
**Azure DevOps Work Item Form Control for PMO Epics**

---

## What this delivers

Project and program managers open an Epic, go to the **Financials** tab, and see:

| Element | Description |
|---|---|
| **Summary banner** | Approved Budget · Total Planned Spend · Remaining · % of Budget with RAG progress bar |
| **Editable grid** | One row per cost line — Fiscal Year, Cost Category, Expense Type (CapEx/OpEx), Q1–Q4 amounts, Notes |
| **Footer totals** | Per-quarter totals + grand total, always in sync |
| **Auto-save** | 300 ms debounce — no "Save" clicks required for normal use |
| **Field writeback** | Computed values written to queryable Epic decimal fields on every change |

---

## Part 1 — Create the Epic fields (Azure DevOps Admin, 20 min)

These fields must exist **before** configuring the extension control.

### 1A — Storage field (holds the JSON rows)

| Setting | Value |
|---|---|
| Field type | **Text (multiple lines)** |
| Name | `Financials Table JSON` |
| Reference name | `Custom.FinancialsTableJson` |

- Add this field to the **Financials** page of the Epic layout.
- Set it **hidden** from the layout (or place it in a collapsed group) — the control reads/writes it directly; users never see raw JSON.

### 1B — Computed / queryable fields

Create each as **Decimal** type on the Epic:

| Name | Reference Name | Purpose |
|---|---|---|
| Total Planned Spend | `Custom.TotalPlannedSpend` | Sum of all Q1–Q4 across all rows |
| Budget Remaining | `Custom.BudgetRemaining` | Approved Budget − Total Planned |
| Percent of Budget | `Custom.PercentOfBudget` | (Planned ÷ Approved) × 100 |

- Place these on the Financials page in a read-only group.
- Mark them **read-only** in the process layout — the extension writes to them programmatically.

### 1C — Which field is "Approved Budget"?

Look at the image: the Budget page already has **Estimated Cost** (`Microsoft.VSTS.Scheduling.StoryPoints` alias differs per process — check your field's reference name in **Process → Fields**). You can reuse it or create a dedicated `Custom.ApprovedBudget` decimal field.

> **Recommended**: Reuse your existing **Estimated Cost** field as the Approved Budget source. It's already visible on the Budget page and queryable. No new field needed.

---

## Part 2 — Add the Financials page and control (Azure DevOps Admin, 10 min)

1. Go to **Organization Settings → Process → DAUT-GES-Agile-PPM-Process-Template → PMO Epic**.
2. Click **New page** → name it `Financials`.
3. On the Financials page, click **Add custom control**.
4. Select **Financial Budget Table** (after publishing the extension in Part 4).
5. In the control **Options panel**, configure these inputs:

| Input | Value |
|---|---|
| JSON Storage Field | `Custom.FinancialsTableJson` |
| Approved Budget Field | `Microsoft.VSTS.Scheduling.StoryPoints` *(or your reference name for Estimated Cost)* |
| Total Planned Spend Field | `Custom.TotalPlannedSpend` |
| Budget Remaining Field | `Custom.BudgetRemaining` |
| Percent of Budget Field | `Custom.PercentOfBudget` |

6. Set the control **height** to `480` (or taller if your rows are many).
7. Save. The Financials tab is live.

---

## Part 3 — Code changes (Developer, 2–3 hours)

### Files changed from the original extension

| File | Change summary |
|---|---|
| `src/index.ts` | **Full rewrite** — purpose-built for budget table; all generic config removed |
| `src/index.html` | **Simplified** — removed tip hint, debug panel, and generic toolbar copy |
| `src/styles.css` | **Streamlined** — removed Select2 styles and generic filter styles; added financial summary and footer totals styles |
| `vss-extension.json` | **Updated** — new extension ID, description, and 4 financial field input properties |
| `src/styles.css` dependency | **Removed** — `select2` import and dependency entirely removed |

### Dependencies to remove

In `package.json`, remove these:

```json
"select2": "^4.1.0-rc.0",
"@types/select2": "^4.0.63"
```

In `src/index.ts`, remove this import (already done in the new file):

```ts
import "select2";
import "select2/dist/css/select2.min.css";
```

Run `npm install` after updating `package.json`.

### What the new `index.ts` does (architecture summary)

```
SDK.init / ready
  └─ provider.onLoaded()
       ├─ readConfig()              reads 5 field refs from Options inputs
       ├─ probeField()              finds the writable JSON storage field (handles Json/JSON casing)
       ├─ loadFromField()           reads JSON → renderTable() → refreshSummary()
       └─ wireButtons()             Add Row / Save buttons

User edits a cell
  └─ markDirty() [300ms debounce]
       ├─ setFieldValue(dataFieldRef, JSON)     auto-saves rows
       ├─ computeFinancials(rows, approvedBudget)
       ├─ renderSummary()           updates banner
       ├─ updateFooterTotals()      updates tfoot row
       └─ writeComputedFields()     setFieldValue × 3 computed fields

provider.onFieldChanged()
  ├─ own echo on dataFieldRef       → skip (skipFieldChangeOnce guard)
  ├─ own echo on computed fields    → skip (skipFieldChangeOnce guard)
  └─ Approved Budget changed externally → refreshSummary() only (no writeback on external change)
```

### Key design decisions

**No column configuration JSON** — The financial schema is fixed (FY, Cost Category, Expense Type, Q1–Q4, Notes). Eliminating the `ColumnConfiguration` input removes the main source of user error and makes the control self-documenting. Other organizations that install this extension get the same schema automatically.

**No Select2** — The original extension used Select2 for filterable column dropdowns. The financial table has short, well-known lists (8 FYs, 6 cost categories, 2 expense types). Native `<select>` is faster, lighter, and equally usable.

**No global search** — `searching: false` in DataTables. A financial budget grid has ≤ 50 rows in practice. The filter row complexity in the original extension is removed entirely.

**Computation is pure** — `computeFinancials(rows, approvedBudget)` has zero SDK dependencies. It's a plain function that can be unit tested with Jest.

**Load does not write back** — On `onLoaded`, computed values are displayed in the UI but **not** written to Epic fields. This prevents the work item from being dirty-flagged every time a user opens it to view.

---

## Part 4 — Build and publish (Developer, 30 min)

```bash
# Install dependencies (after removing select2 from package.json)
npm install

# Build production bundle
npm run build

# Package as .vsix
npx tfx-cli extension create --manifest-globs vss-extension.json --rev-version

# Publish to your organization (private) — replace with your PAT
npx tfx-cli extension publish \
  --manifest-globs vss-extension.json \
  --token YOUR_PAT_HERE
```

After publishing, go to your Azure DevOps organization → **Organization Settings → Extensions** and confirm the extension is installed.

---

## Part 5 — Column schema reference

The grid always renders these fixed columns in this order:

| Column | Input type | Options / behavior |
|---|---|---|
| Fiscal Year | `<select>` | FY25–FY32; sorted ascending by default |
| Cost Category | `<select>` | Labor, Materials & Supplies, Travel & Expenses, Contracts, Software, Other |
| Type | `<select>` | CapEx, OpEx |
| Q1 ($) | `<input type="number">` | Min 0, step 1,000; right-aligned |
| Q2 ($) | `<input type="number">` | Same |
| Q3 ($) | `<input type="number">` | Same |
| Q4 ($) | `<input type="number">` | Same |
| Notes | `<input type="text">` | Free text |
| Actions | Delete button | Removes the row |

To change the fiscal year list or cost categories in the future, update the `FISCAL_YEARS` and `COST_CATS` arrays at the top of `src/index.ts`. No Options configuration change needed.

---

## Part 6 — Querying the data (WIQL / Analytics)

Because computed values are written into native Epic decimal fields, PMOs can query without any custom tooling:

**Example WIQL — Epics over 90% budget**

```sql
SELECT [System.Id], [System.Title], [Custom.TotalPlannedSpend],
       [Custom.BudgetRemaining], [Custom.PercentOfBudget]
FROM WorkItems
WHERE [System.WorkItemType] = 'PMO Epic'
  AND [Custom.PercentOfBudget] >= 90
ORDER BY [Custom.PercentOfBudget] DESC
```

**Dashboard widget** — Add a **Work Item Query Chart** widget pointing to this query. No Power BI required.

**Sprint / iteration rollup** — The fields work in the native Azure DevOps backlog rollup columns once added to the process.

---

## Part 7 — Extending to other organizations

Because the extension uses the **Options panel** for all field references, any other organization that installs it only needs to:

1. Create the five fields listed in Part 1 (or reuse existing ones with matching types).
2. Add the control to their Epic layout.
3. Configure the five field references in the Options panel.

No code changes. The extension works as a generic financial budget table for any Azure DevOps organization running the same pattern.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Summary shows "$0 Approved Budget" | Approved Budget field ref not configured or field is empty | Check Options → Approved Budget Field input |
| "Field not writable" status | JSON storage field ref is wrong or field isn't on the work item form | Verify `Custom.FinancialsTableJson` exists on Epic and is on the Financials page |
| Computed fields not updating | Total Spent / Remaining / Percent field refs not configured | Set all three in Options panel |
| Extension height too small | Default 480px may clip on small screens | Increase `height` in Options or in `vss-extension.json` |
| Rows disappear on refresh | JSON field is Html type and stripping content | Change field type to **Plain Text (multiple lines)** |
