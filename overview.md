# ADO Epic Budget Table

Give your PMO budget visibility **directly inside Epic work items** — no Power BI, no spreadsheets, no external tools.

## What it does

Add a **Budget** tab to any PMO Epic. Project managers enter spend amounts by Fiscal Year across quarterly columns (Q1–Q4). The extension automatically:

- Shows a **transposed budget grid** — fixed Q1/Q2/Q3/Q4 rows, dynamic fiscal year columns, FY totals in the footer
- Reads **Estimated Cost** from your existing Epic field and displays it as the approved budget
- Computes **Total Committed Spend**, **Budget Remaining**, and **% of Budget**
- Shows a live **RAG-coloured summary banner** and progress bar (green < 75%, amber 75–90%, red > 90%)
- Formats monetary values using your **Currency** field (USD, EUR, GBP, INR, JPY and 15+ others)
- Writes computed values back to **queryable Epic decimal fields** — use in WIQL queries, dashboards, and backlog rollups without any additional tooling

## Setup (5 minutes)

### 1. Create Epic fields

In **Organization Settings → Boards → Process → [Your Process] → PMO Epic**, create:

| Field Name | Type | Reference Name |
|---|---|---|
| Financials Table JSON | Text (multiple lines, Plain Text) | `Custom.FinancialsTableJson` |
| Total Committed Spend | Decimal | `Custom.TotalPlannedSpend` |
| Total Budget Remaining | Decimal | `Custom.TotalBudgetRemaining` |
| Percent of Budget | Decimal | `Custom.PercentOfBudget` |

> **Tip:** The extension reads your existing **Estimated Cost** (`Custom.EstimatedCost`) field as the approved budget — no new field needed for that. It also reads **Currency** (`Custom.Currency`) to format amounts correctly for your team.

### 2. Add the control to your Epic layout

1. Go to **Organization Settings → Boards → Process → [Your Process] → PMO Epic**
2. Open or create the **Budget** page
3. Click **Add custom control** → select **ADO Epic Budget Table**
4. Click the control → **Options** tab → configure the five field references:

| Option | Value |
|---|---|
| JSON Storage Field | `Custom.FinancialsTableJson` |
| Approved Budget Field | `Custom.EstimatedCost` (or your equivalent field) |
| Total Planned Spend Field | `Custom.TotalPlannedSpend` |
| Budget Remaining Field | `Custom.TotalBudgetRemaining` |
| Percent of Budget Field | `Custom.PercentOfBudget` |
| Currency Field | `Custom.Currency` (optional — defaults to USD) |

### 3. Open any Epic → Budget tab

Click **Add FY** to add fiscal years as columns, enter Q1–Q4 amounts, and watch the summary banner update live. Click **Save** to persist and write KPIs back to the Epic fields.

## Querying budget data (no Power BI needed)

Because computed values are written to native Epic decimal fields, you can query them directly in WIQL:

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

Use this as a **Work Item Query Chart** widget on your Azure DevOps dashboard. No additional tooling required.

## Local development

```bash
git clone https://github.com/deenuy/ado-epic-budget-data-table.git
cd ado-epic-budget-data-table
npm install
npm run build       # production bundle to dist/
npm run dev         # watch mode
npm run package     # builds and drops .vsix into releases/
```

See the [GitHub repository](https://github.com/deenuy/ado-epic-budget-data-table) for the full development guide.

## No external services required

All computation happens in the browser. Data is stored in your Azure DevOps fields. Nothing leaves your organisation.