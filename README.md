<div align="center">

# ADO Epic Budget Table

**Financial budget planning built directly into Azure DevOps Epic work items.**

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/deenuy.ado-epic-budget-data-table?label=Marketplace&color=0078d4)](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-epic-budget-data-table)
[![GitHub Stars](https://img.shields.io/github/stars/deenuy/ado-epic-budget-data-table?style=flat&color=ffd700)](https://github.com/deenuy/ado-epic-budget-data-table/stargazers)
[![Build](https://github.com/deenuy/ado-epic-budget-data-table/actions/workflows/ci.yml/badge.svg)](https://github.com/deenuy/ado-epic-budget-data-table/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[**Install from Marketplace**](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-epic-budget-data-table) · [**Quick Start**](#quick-start) · [**Contribute**](CONTRIBUTING.md)

</div>

---

## The problem

Project managers in Azure DevOps have no native way to plan and track budget spend by **fiscal year and quarter** on an Epic. The typical workarounds (Excel files, SharePoint lists, Power BI datasets) live outside the work item, break traceability, and require separate maintenance.

This extension puts a full budget planning table **directly on the Epic's Budget tab**, auto-computes your financial KPIs, and writes results to **queryable Epic decimal fields** so WIQL queries, dashboards, and backlog rollups reflect real budget data with no external tooling.

---

## What you get

| Feature | Detail |
|---|---|
| **Transposed budget grid** | Fixed Q1-Q4 rows with one column per fiscal year. Add or remove fiscal years as columns. FY total shown in the footer per column. |
| **Summary banner** | Approved Budget, Total Committed Spend, Remaining, and % of Budget with a RAG colour-coded progress bar (green below 75%, amber 75-90%, red above 90%) |
| **Auto-save** | Edits persist automatically with a 400ms debounce. No Save button required for normal use. |
| **Currency support** | Reads ISO 4217 code from your Currency field. Supports USD, EUR, GBP, INR, JPY, and 15+ others. |
| **Field writeback** | Computed KPIs written to native Epic decimal fields, queryable via WIQL and dashboard widgets. |
| **Light / dark mode** | Respects the Azure DevOps theme automatically via CSS custom properties. |
| **No Power BI. No Power Automate. No external databases.** | All computation runs in the browser. Nothing leaves your organization. |

---

## Quick Start

### 1 - Install the extension

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-epic-budget-data-table).

### 2 - Create Epic fields

In **Organization Settings -> Process -> [Your Process] -> Epic**, create these fields:

| Field Name | Type | Reference Name |
|---|---|---|
| Financials Table JSON | Text (multiple lines, Plain Text) | `Custom.FinancialsTableJson` |
| Total Planned Spend | Decimal | `Custom.TotalPlannedSpend` |
| Total Budget Remaining | Decimal | `Custom.TotalBudgetRemaining` |
| Percent of Budget | Decimal | `Custom.PercentOfBudget` |

> **Tip:** Point the Approved Budget Field at your existing Estimated Cost (`Custom.EstimatedCost`) or equivalent decimal field. No new field needed.

### 3 - Add the control to your Epic layout

1. Go to **Organization Settings -> Process -> [Your Process] -> Epic**
2. Open the page where you want the control (e.g. Budget)
3. Click **Add custom control** -> select **ADO Epic Budget Table**

### 4 - Configure the control options

| Input | Value |
|---|---|
| JSON Storage Field | `Custom.FinancialsTableJson` |
| Approved Budget Field | `Custom.EstimatedCost` (or your equivalent approved budget field) |
| Total Planned Spend Field | `Custom.TotalPlannedSpend` |
| Budget Remaining Field | `Custom.TotalBudgetRemaining` |
| Percent of Budget Field | `Custom.PercentOfBudget` |

### 5 - Open any Epic

Click the Budget tab, add rows, enter quarterly amounts, and watch the summary update live.

---

## Querying budget data (no Power BI needed)

Because computed values are written to native Epic decimal fields, you can query them directly in WIQL:

```sql
SELECT [System.Id], [System.Title],
    [Custom.TotalPlannedSpend],
    [Custom.TotalBudgetRemaining],
    [Custom.PercentOfBudget]
FROM WorkItems
WHERE [System.WorkItemType] = 'Epic'
  AND [Custom.PercentOfBudget] >= 90
ORDER BY [Custom.PercentOfBudget] DESC
```

Use this as a **Work Item Query Chart** widget on your Azure DevOps dashboard. No additional tooling required.

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

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide.

---

## Roadmap

- [ ] Multi-currency support with per-row currency selector
- [ ] Actuals columns (Q1-Q4 Actual vs Planned variance)
- [ ] Export budget table to CSV
- [ ] Portfolio dashboard widget to aggregate across Epics via WIQL
- [ ] Lock rows by Epic state (read-only when Approved)
- [ ] Jest unit tests for `computeFinancials`

See [open issues](https://github.com/deenuy/ado-epic-budget-data-table/issues) to pick something up.

---

## Contributing

Contributions of all sizes are welcome, from fixing a typo to building a roadmap feature.

Read the [Contributing Guide](CONTRIBUTING.md) to get started.

---

## License

[MIT](LICENSE) - free to use, modify, and distribute.

---

## Author

Built by **Deenu Gengiti**

If this saves your team time:
- Star this repo - helps others find it
- Leave a review on the [VS Marketplace](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-epic-budget-data-table)
- File issues - every bug report makes the extension better

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin)](https://linkedin.com/in/deenuy)