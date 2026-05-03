# Financial Budget Table for Azure DevOps

Give your PMO budget visibility **directly inside Epic work items** — no Power BI, no spreadsheets, no external tools.

## What it does

Add a **Financials** tab to any Epic. Project managers enter budget rows by Fiscal Year, Cost Category, and Expense Type, and fill in Q1–Q4 spend amounts. The extension automatically:

- Computes **Total Planned Spend**, **Budget Remaining**, and **% of Budget**
- Shows a live **RAG-coloured summary banner** and progress bar
- Writes computed values back to **queryable Epic decimal fields** — WIQL, dashboards, and backlog rollups work without any additional tooling

## Setup (5 minutes)

1. Create five Epic fields (one multiline text for JSON storage, three decimals for computed values)
2. Add a **Financials** page to your Epic layout
3. Drop the control onto the page and configure the five field references in the Options panel
4. Open any Epic → Financials tab → start planning

See the [GitHub repository](https://github.com/YOUR_GITHUB_USERNAME/ado-epic-budget-table) for the full setup guide.

## No external services required

All computation happens in the browser. Data is stored in your Azure DevOps fields. Nothing leaves your organization.
