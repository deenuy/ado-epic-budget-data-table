# ADO Epic Budget Table: Implementation Guide

**Azure DevOps Work Item Form Control for PMO Epics**

---

## What this delivers

Project and program managers open a PMO Epic, navigate to the **Budget** tab, and see:

| Element | Description |
|---|---|
| **Summary banner** | Approved Budget, Total Committed Spend, Remaining, and % of Budget with a RAG progress bar |
| **Transposed budget grid** | Fixed Q1/Q2/Q3/Q4 rows with one column per fiscal year and FY totals in the footer |
| **Add FY / Delete** | Add a fiscal year as a new column or remove one. Columns are always ordered ascending. |
| **Auto-save** | Edits are saved automatically with a 400ms debounce. No manual Save required for normal use. |
| **Currency formatting** | Reads an ISO 4217 currency code from your Currency field. Supports USD, EUR, GBP, INR, JPY, and 15+ others. |
| **Field writeback** | Computed KPIs are written back to queryable Epic decimal fields on every save. |

---

## Part 1: Create the Epic fields (Admin, ~20 minutes)

These fields must exist on the PMO Epic work item type **before** you configure the extension control.

### 1A: JSON storage field

| Setting | Value |
|---|---|
| Field type | Text (multiple lines, Plain Text) |
| Name | `Financials Table JSON` |
| Reference name | `Custom.FinancialsTableJson` |

Add this field to the Budget page layout. Hide it from view or place it in a collapsed group. Users never interact with raw JSON directly. The extension reads and writes this field via the SDK.

### 1B: Computed queryable fields

Create each field as **Decimal** type on the PMO Epic work item type:

| Display Name | Reference Name | Written by extension |
|---|---|---|
| Total Committed Spend | `Custom.TotalPlannedSpend` | Sum of all Q1-Q4 amounts across all fiscal years |
| Total Budget Remaining | `Custom.TotalBudgetRemaining` | Approved Budget minus Total Committed Spend |
| Percent of Budget | `Custom.PercentOfBudget` | (Committed Spend / Approved Budget) x 100 |

Set these fields to read-only in the process layout, or hide them from the form. The extension attempts to enforce read-only via `setFieldOptions` on load. This call is best-effort and silently skips on Azure DevOps Server versions that do not implement the API. These fields are surfaced in the summary banner, not as editable form inputs.

### 1C: Approved budget source

The extension reads your existing **Estimated Cost** field (`Custom.EstimatedCost`) as the approved budget source. No additional field is required. If your process template uses a different field, specify its reference name in the Options panel.

### 1D: Currency field (optional)

The extension reads the **Currency** field (`Custom.Currency`) to format all monetary values using the correct symbol. If the field contains `USD`, amounts display as `$`. If it contains `EUR`, amounts display as `€`. When the field is absent or empty, the extension defaults to USD.

---

## Part 2: Add the control to the Budget page (Admin, ~10 minutes)

1. Go to **Organization Settings > Boards > Process > [Your Inherited Process] > PMO Epic**.
2. Open the **Budget** page, or create a new page named `Budget`.
3. Select **Add custom control** and choose **ADO Epic Budget Table**.
4. Select the control, open the **Options** tab, and configure the field references:

| Option | Value |
|---|---|
| JSON Storage Field | `Custom.FinancialsTableJson` |
| Approved Budget Field | `Custom.EstimatedCost` |
| Total Planned Spend Field | `Custom.TotalPlannedSpend` |
| Budget Remaining Field | `Custom.TotalBudgetRemaining` |
| Percent of Budget Field | `Custom.PercentOfBudget` |
| Currency Field | `Custom.Currency` (optional, defaults to USD if left blank) |

5. Save the layout. The Budget tab is immediately available on all PMO Epics.

> **Note on height:** The control defaults to 720px, which comfortably shows four to five fiscal year columns. Height is managed dynamically. The iframe measures actual rendered content and resizes after every render and work item save.

---

## Part 3: How the extension works

### Initialization flow

```
SDK.init / ready
  └─ provider.onLoaded()
       ├─ readConfig()           reads 6 field refs from Options inputs
       ├─ probeField()           resolves the JSON storage field (handles Json/JSON casing variants)
       ├─ setFieldOptions()      marks computed fields read-only on the form (best-effort)
       ├─ readCurrency()         reads Custom.Currency and caches the ISO code for the session
       ├─ loadFromField()        reads JSON, calls renderTable() and renderSummary()
       └─ wires Add FY and Save buttons

User edits a cell or adds/removes a fiscal year column
  └─ markDirty() [400ms debounce] -> runSave()
       ├─ setFieldValue(dataFieldRef, JSON)        persists rows to the storage field
       ├─ readApprovedBudget()                      reads Approved Budget field (Custom.EstimatedCost)
       ├─ computeFinancials(rows, approvedBudget)   pure function with no SDK dependencies
       ├─ renderSummary()                            updates the banner
       └─ writeComputedFields()                     calls setFieldValue for each of the 3 computed fields

provider.onFieldChanged()
  ├─ echo from own writes        skipped via skipFieldChangeOnce counter
  ├─ external JSON field change  calls loadFromField() to reload from another tab or user
  ├─ Currency field changed      calls readCurrency() then refreshSummary()
  └─ Approved Budget changed     calls refreshSummary() only (no writeback on external change)
```

### Key design decisions

**Transposed layout.** The grid uses fixed Q1-Q4 rows with fiscal years as columns. This makes year-over-year comparison immediate and removes the underutilized Notes column from the original design. FY totals in the footer provide per-year spend visibility at a glance.

**No DataTables.** The table is rendered as a plain HTML table from data directly. This removes a 60KB dependency, eliminates up to 144 per-render event listener allocations, and allows full control over the transposed column structure that DataTables cannot produce natively.

**Event delegation.** A single delegated handler on `#tableWrap` covers all cell inputs and delete buttons. Removing per-cell listeners eliminates allocation churn during rapid add and remove operations.

**Save concurrency guard.** `runSave()` enforces mutual exclusion via a `saving` flag with a queued follow-up. This prevents overlapping writes when the debounced auto-save and the explicit Save button fire in close succession.

**Pure financial computation.** `computeFinancials(rows, approvedBudget)` has no SDK dependencies and can be unit tested independently with Jest.

**Load does not write back.** On `onLoaded`, computed values are displayed in the UI but not written to Epic fields. This prevents the work item from being marked dirty every time a user opens it to review budget data.

---

## Part 4: Build and publish (Developer, ~30 minutes)

```bash
# Install dependencies
npm install

# Build the production bundle
npm run build

# Package as .vsix (output goes to releases/)
npm run package

# Publish to the Visual Studio Marketplace
npx tfx-cli extension publish \
  --manifest-globs vss-extension.json \
  --token YOUR_MARKETPLACE_PAT
```

Alternatively, use the Makefile to build, package, commit, tag, and push in a single step:

```bash
make release MSG="describe your changes here"
```

After publishing, verify the installed version in **Organization Settings > Extensions**.

---

## Part 5: Querying budget data

Because computed values are written to native Epic decimal fields, you can query them directly in WIQL without Power BI or any external tooling:

```sql
SELECT [System.Id], [System.Title],
    [Custom.TotalPlannedSpend],
    [Custom.TotalBudgetRemaining],
    [Custom.PercentOfBudget]
FROM WorkItems
WHERE [System.WorkItemType] = 'PMO Epic'
  AND [Custom.PercentOfBudget] >= 90
ORDER BY [Custom.PercentOfBudget] DESC
```

Add this query as a **Work Item Query Chart** widget to your Azure DevOps dashboard for at-a-glance portfolio budget health.

---

## Part 6: Supported currencies

The extension reads the ISO 4217 code from `Custom.Currency` and maps it to the appropriate symbol:

| Code | Symbol | Code | Symbol | Code | Symbol |
|---|---|---|---|---|---|
| USD | $ | EUR | € | GBP | £ |
| INR | Rs | JPY | ¥ | CNY | ¥ |
| CAD | CA$ | AUD | A$ | NZD | NZ$ |
| HKD | HK$ | SGD | S$ | KRW | Rs |
| BRL | R$ | MXN | MX$ | ZAR | R |
| SEK | kr | NOK | kr | DKK | kr |
| AED | AED | SAR | SAR | CHF | CHF |

Codes not in this list display the raw code as a prefix (for example, `THB 55,000`). The extension defaults to USD when the field is empty or absent.

---

## Part 7: Extending to other organizations

The extension uses the Options panel for all field references. To deploy to another organization:

1. Create the fields described in Part 1, or reuse existing fields with compatible types.
2. Add the control to the Epic layout.
3. Configure the six field references in the Options panel.

No code changes are required. The extension works as a generic quarterly budget planning control for any Azure DevOps organization.

---

## Troubleshooting

| Symptom | Likely cause | Resolution |
|---|---|---|
| Banner shows "Not set" for Estimated Cost | The Approved Budget field ref is not configured, or `Custom.EstimatedCost` does not exist on the PMO Epic work item type. | Open Options and verify the Approved Budget Field value. Confirm the field exists under **Process > Fields**. |
| Status bar shows "Field not writable" on load | The JSON storage field reference is incorrect, or the field is not present on the work item form. | Verify that `Custom.FinancialsTableJson` exists on the PMO Epic and is added to the Budget page layout. |
| Computed fields are not updating | The Total Planned Spend, Budget Remaining, and Percent of Budget field refs are not configured. | Set all three reference names in the Options panel. |
| Amounts show $ when currency is EUR | `Custom.Currency` is empty or the Currency Field option is not configured. | Set the Currency Field option to `Custom.Currency` in the Options panel. Confirm the field has a value on the Epic. |
| Table is empty after save | The JSON storage field type is HTML rather than Plain Text. Azure DevOps strips content from HTML fields during save. | Change the field type to Plain Text (multiple lines). |
| Data disappears on page refresh | The value in `Custom.FinancialsTableJson` is corrupted. | Open browser DevTools and filter the console for `[FIN]` to locate the parse error. |