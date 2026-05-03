# ADO Epic Budget Table

Give your PMO budget visibility **directly inside Epic work items** — no Power BI, no spreadsheets, no external tools.

## What it does

Add a **Financials** tab to any Epic. Project managers enter budget rows by Fiscal Year with Q1–Q4 quarterly spend amounts. The extension automatically:

- Computes **Total Planned Spend**, **Budget Remaining**, and **% of Budget**
- Shows a live **RAG-coloured summary banner** and progress bar (green / amber / red)
- Writes computed values back to **queryable Epic decimal fields** — use in WIQL queries, dashboards, and backlog rollups without any additional tooling

## Setup (5 minutes)

1. Create these fields on your Epic in Process settings:

| Field | Type | Reference Name |
|---|---|---|
| Financials Table JSON | Text (multiple lines — Plain Text) | Custom.FinancialsTableJson |
| Total Planned Spend | Decimal | Custom.TotalPlannedSpend |
| Total Budget Remaining | Decimal | Custom.TotalBudgetRemaining |
| Percent of Budget | Decimal | Custom.PercentOfBudget |

2. Add a **Financials** page to your Epic layout
3. Add this control to the page and configure the five field references in the Options panel:
    - JSON Storage Field → Custom.FinancialsTableJson
    - Approved Budget Field → your existing Estimated Cost or Approved Budget field
    - Total Planned Spend Field → Custom.TotalPlannedSpend
    - Budget Remaining Field → Custom.TotalBudgetRemaining
    - Percent of Budget Field → Custom.PercentOfBudget
4. Open any Epic → Financials tab → start planning

See the [GitHub repository](https://github.com/deenuy/ado-epic-budget-data-table) for the full setup guide.

## No external services required

All computation happens in the browser. Data is stored in your Azure DevOps fields. Nothing leaves your organization.