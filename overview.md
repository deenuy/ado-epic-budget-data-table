# ADO Epic Budget Table

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/deenuy.ado-epic-budget-data-table?label=Marketplace&color=0078d4)](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-epic-budget-data-table)
[![GitHub Stars](https://img.shields.io/github/stars/deenuy/ado-epic-budget-data-table?style=flat&color=ffd700)](https://github.com/deenuy/ado-epic-budget-data-table/stargazers)
[![Build](https://github.com/deenuy/ado-epic-budget-data-table/actions/workflows/ci.yml/badge.svg)](https://github.com/deenuy/ado-epic-budget-data-table/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Give your PMO budget visibility directly inside Epic work items. No Power BI, no spreadsheets, no external tools.**

> **Source code:** [github.com/deenuy/ado-epic-budget-data-table](https://github.com/deenuy/ado-epic-budget-data-table)
> **Report issues:** [github.com/deenuy/ado-epic-budget-data-table/issues](https://github.com/deenuy/ado-epic-budget-data-table/issues)

<!-- [IMAGE REQUIRED: Full extension screenshot showing the Budget tab with summary banner and transposed grid] -->
<!-- Title: ADO Epic Budget Table showing Approved Budget, Total Committed Spend, Remaining, and fiscal year columns -->

---

## What it does

Add a **Budget** tab to any PMO Epic. Project managers enter spend amounts by Fiscal Year across quarterly columns (Q1-Q4). The extension automatically:

- Shows a **transposed budget grid** with fixed Q1/Q2/Q3/Q4 rows, dynamic fiscal year columns, and FY totals in the footer
- Reads your **Approved Budget** from the configured Epic decimal field (defaults to `Custom.EstimatedCost`)
- Computes **Total Committed Spend**, **Budget Remaining**, and **% of Budget**
- Shows a live **RAG-coloured summary banner** and progress bar (green below 75%, amber 75-90%, red above 90%)
- Formats monetary values using your **Currency** field (USD, EUR, GBP, INR, JPY, and 15+ others)
- Writes computed values back to **queryable Epic decimal fields** for use in WIQL queries, dashboards, and backlog rollups

---

## Key features

| Feature | Detail |
|---|---|
| **Transposed budget grid** | Fixed Q1-Q4 rows. Add or remove fiscal years as columns. FY total shown in footer per column. |
| **Summary banner** | Approved Budget, Total Committed Spend, Remaining, and % of Budget with RAG progress bar. |
| **Auto-save** | Edits persist automatically with a 400ms debounce. No manual Save required for normal use. |
| **Currency support** | Reads ISO 4217 code from your Currency field. Supports 20+ currencies including USD, EUR, GBP, and INR. |
| **Field writeback** | Computed KPIs written to native Epic decimal fields, queryable via WIQL and dashboard widgets. |
| **Light / dark mode** | Respects the Azure DevOps theme automatically. No configuration required. |
| **No external dependencies** | All computation runs in the browser. Data is stored in your Azure DevOps fields. Nothing leaves your organization. |

---

## Complete setup guide

### Phase 1: Install the extension

#### Step 1: Open the Visual Studio Marketplace

Navigate to the [Visual Studio Marketplace](https://marketplace.visualstudio.com/azuredevops) and search for **ADO Epic Budget Table**.

<!-- [IMAGE REQUIRED: Visual Studio Marketplace search results showing ADO Epic Budget Table] -->
<!-- Title: Search results in the Visual Studio Marketplace -->

#### Step 2: Install to your organization

1. Click **Get it free** on the extension page.
2. Select the organization where you want to install the extension.
3. Click **Install**.
4. Click **Proceed to organization** to confirm.

<!-- [IMAGE REQUIRED: Extension installation dialog with organization selector] -->
<!-- Title: Selecting the target organization during installation -->

---

### Phase 2: Create Epic fields

These fields must exist on the PMO Epic work item type before you configure the extension control.

#### Step 3: Open Process settings

1. Go to **Organization Settings**.
2. Select **Boards > Process**.
3. Click on your inherited process (for example, **Your-Inherited-Process-Template**).
4. Click **PMO Epic** to open work item type customization.

<!-- [IMAGE REQUIRED: Organization Settings > Process showing the inherited process list] -->
<!-- Title: Navigating to the PMO Epic work item type in Process settings -->

#### Step 4: Create the JSON storage field

1. Click **New field**.
2. Configure the field as follows:

| Setting | Value |
|---|---|
| Name | `Financials Table JSON` |
| Type | Text (multiple lines, Plain Text) |
| Reference name | `Custom.FinancialsTableJson` |

3. Click **Add field**.
4. In the layout editor, hide this field from the page or place it in a collapsed group. Users never interact with raw JSON directly.

<!-- [IMAGE REQUIRED: New field dialog with name, type, and reference name filled in] -->
<!-- Title: Creating the Financials Table JSON field with Plain Text type -->

#### Step 5: Create the computed queryable fields

Create each of the following as **Decimal** type on the PMO Epic:

| Display Name | Reference Name | Purpose |
|---|---|---|
| Total Committed Spend | `Custom.TotalPlannedSpend` | Sum of all Q1-Q4 amounts across all fiscal years |
| Total Budget Remaining | `Custom.TotalBudgetRemaining` | Approved Budget minus Total Committed Spend |
| Percent of Budget | `Custom.PercentOfBudget` | (Committed Spend / Approved Budget) x 100 |

Set these fields to **read-only** in the process layout, or hide them from the form. The extension writes to them programmatically. They are surfaced in the summary banner and are queryable via WIQL.

<!-- [IMAGE REQUIRED: Process layout showing the three computed Decimal fields added to Budget Governance group] -->
<!-- Title: Computed decimal fields added to the PMO Epic layout -->

> **Tip:** The extension reads your existing **Estimated Cost** (`Custom.EstimatedCost`) field as the approved budget. No new field is needed for that. It also reads **Currency** (`Custom.Currency`) to format amounts correctly.

---

### Phase 3: Add the control to the Budget page

#### Step 6: Open the Budget page layout

1. In the PMO Epic customization view, open or create the **Budget** page.
2. Click **Add custom control**.

<!-- [IMAGE REQUIRED: Budget page layout editor with the Add custom control button highlighted] -->
<!-- Title: Adding a custom control to the Budget page -->

#### Step 7: Select ADO Epic Budget Table

1. Find **ADO Epic Budget Table** in the control list.
2. Click to select it.

<!-- [IMAGE REQUIRED: Custom control selection dialog showing ADO Epic Budget Table] -->
<!-- Title: Selecting the ADO Epic Budget Table control -->

#### Step 8: Configure the Options panel

1. Click the control.
2. Open the **Options** tab.
3. Configure the six field references:

| Option | Value |
|---|---|
| JSON Storage Field | `Custom.FinancialsTableJson` |
| Approved Budget Field | `Custom.EstimatedCost` |
| Total Planned Spend Field | `Custom.TotalPlannedSpend` |
| Budget Remaining Field | `Custom.TotalBudgetRemaining` |
| Percent of Budget Field | `Custom.PercentOfBudget` |
| Currency Field | `Custom.Currency` (optional, defaults to USD) |

<!-- [IMAGE REQUIRED: Options tab showing all six field references configured] -->
<!-- Title: Options panel with all field references configured -->

4. Open the **Layout** tab.
5. Set the page to **Budget** and assign the control to an appropriate group.
6. Click **OK** and save the layout.

<!-- [IMAGE REQUIRED: Layout tab showing page set to Budget] -->
<!-- Title: Layout tab configuration for the ADO Epic Budget Table control -->

---

### Phase 4: Use the extension

#### Step 9: Open a PMO Epic

Navigate to any PMO Epic in your project and click the **Budget** tab.

<!-- [IMAGE REQUIRED: PMO Epic with Budget tab selected, showing the full extension] -->
<!-- Title: Budget tab on a PMO Epic showing the summary banner and grid -->

#### Step 10: Add fiscal years and enter amounts

1. Click **Add FY** to add the next sequential fiscal year as a column.
2. Enter Q1-Q4 spend amounts directly in the cells.
3. The FY TOTAL row updates automatically as you type.
4. The summary banner updates on every cell change.
5. Click **Save** to persist all changes and write KPIs back to the Epic fields.

<!-- [IMAGE REQUIRED: Transposed grid with multiple FY columns and amounts entered, showing FY totals in footer] -->
<!-- Title: Transposed budget grid with fiscal year columns and quarterly spend amounts -->

<!-- [IMAGE REQUIRED: Summary banner showing Approved Budget, Total Committed Spend, Remaining, and % of Budget with red RAG bar] -->
<!-- Title: Summary banner with RAG-coloured progress bar indicating over-budget status -->

---

## Querying budget data

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

Add this as a **Work Item Query Chart** widget on your Azure DevOps dashboard for at-a-glance portfolio budget health.

<!-- [IMAGE REQUIRED: Azure DevOps dashboard showing a Work Item Query Chart widget using the budget fields] -->
<!-- Title: Dashboard widget showing PMO Epics over 90% of budget -->

---

## Supported currencies

The extension reads the ISO 4217 code from `Custom.Currency` and formats all amounts with the correct symbol:

| Code | Symbol | Code | Symbol | Code | Symbol |
|---|---|---|---|---|---|
| USD | $ | EUR | € | GBP | £ |
| INR | Rs | JPY | ¥ | CNY | ¥ |
| CAD | CA$ | AUD | A$ | NZD | NZ$ |
| HKD | HK$ | SGD | S$ | KRW | Rs |
| BRL | R$ | MXN | MX$ | ZAR | R |
| SEK | kr | NOK | kr | DKK | kr |
| AED | AED | SAR | SAR | CHF | CHF |

Codes not in this list display the raw code as a prefix (for example, `THB 55,000`). Defaults to USD when the field is empty or absent.

---

## Troubleshooting

| Symptom | Likely cause | Resolution |
|---|---|---|
| Banner shows "Not set" for Estimated Cost | Approved Budget field ref is not configured, or `Custom.EstimatedCost` does not exist on the PMO Epic. | Open the Options tab and verify the Approved Budget Field value. Confirm the field exists under **Process > Fields**. |
| Status shows "Field not writable" on load | The JSON storage field reference is incorrect, or the field is not on the work item form. | Verify that `Custom.FinancialsTableJson` exists on the PMO Epic and is added to the Budget page layout. |
| Computed fields are not updating | Total Planned Spend, Budget Remaining, and Percent of Budget field refs are not configured. | Set all three reference names in the Options panel. |
| Amounts show $ when currency is EUR | `Custom.Currency` field is empty or the Currency Field option is not configured. | Set the Currency Field option to `Custom.Currency` in the Options panel and confirm the field has a value on the Epic. |
| Table is empty after save | The JSON storage field type is HTML rather than Plain Text. Azure DevOps strips content from HTML fields. | Change the field type to **Plain Text (multiple lines)**. |
| Data disappears on page refresh | The value in `Custom.FinancialsTableJson` is corrupted. | Open browser DevTools and filter the console for `[FIN]` to locate the parse error. |

---

## Local development

```bash
git clone https://github.com/deenuy/ado-epic-budget-data-table.git
cd ado-epic-budget-data-table
npm install
npm run build       # production bundle to dist/
npm run dev         # watch mode
npm run package     # builds and drops .vsix into releases/
```

See the [GitHub repository](https://github.com/deenuy/ado-epic-budget-data-table) for the full development guide and contribution instructions.

---

## No external services required

All computation runs in the browser. Data is stored in your Azure DevOps fields. Nothing leaves your organization.