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

## Overview

Project managers in Azure DevOps have no native way to plan and track budget spend by fiscal year and quarter on an Epic. The typical workarounds (Excel files, SharePoint lists, Power BI datasets) live outside the work item, break traceability, and require separate maintenance.

This extension adds a **Budget tab** directly to any Epic. Budget data is entered once, computed automatically, and stored in native Azure DevOps fields. This makes the data immediately available for WIQL queries, dashboard widgets, and portfolio reporting with no external tooling.

---

## What you get

| Capability | Business value |
|---|---|
| **Quarterly budget planning** | Plan spend across Q1 to Q4 for each fiscal year in a single, structured view. No spreadsheets to maintain separately. |
| **Instant budget health visibility** | A colour-coded summary banner shows Approved Budget, Total Committed Spend, Remaining, and % of Budget. Over-budget Epics are flagged immediately with the exact overage amount. |
| **Portfolio reporting without Power BI** | Computed values are written to queryable Epic fields on every save. Use them in WIQL queries and Azure DevOps dashboard widgets across the portfolio. |
| **Year-over-year spend analysis** | Per-fiscal-year spend is stored in individual fields (FY25 through FY35), enabling trend analysis and multi-year comparisons directly in Azure DevOps. |
| **Multi-currency support** | Reads the currency code from your existing Currency field. Supports USD, EUR, GBP, INR, JPY, and 15+ others. Useful for globally distributed teams. |
| **No additional cost or infrastructure** | All computation runs in the browser. Data is stored in your Azure DevOps fields. Nothing leaves your organization. No Power BI, Power Automate, or external databases required. |

---

## Quick Start

### 1. Install the extension

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-epic-budget-data-table).

### 2. Create Epic fields

In **Organization Settings > Process > [Your Process] > PMO Epic**, create these fields:

| Field Name | Reference Name | Data Type | Required? |
|---|---|---|---|
| Financials Table JSON | `Custom.FinancialsTableJson` | Text (Multiple Lines, Plain Text) | **Yes** |
| Estimated Cost | `Custom.EstimatedCost` | Decimal | Optional (Maps Approved Budget) |
| Total Committed Spend | `Custom.TotalPlannedSpend` | Decimal | Optional |
| Total Budget Remaining | `Custom.TotalBudgetRemaining` | Decimal | Optional |
| Percent of Budget | `Custom.PercentOfBudget` | Decimal | Optional |
| Currency | `Custom.Currency` | Text (Single Line) | Optional (Defaults to USD) |

> **Tip:** The extension reads your existing Estimated Cost field (`Custom.EstimatedCost`) as the Approved Budget. No new field is needed if it is already present.

### 3. Add the control to your Epic layout

1. Go to **Organization Settings > Process > [Your Process] > PMO Epic**.
2. Open or create the **Budget** page.
3. Click **Add custom control** and select **ADO Epic Budget Table**.

### 4. Configure the control options

| Option | Value |
|---|---|
| JSON Storage Field | `Custom.FinancialsTableJson` |
| Approved Budget Field | `Custom.EstimatedCost` |
| Total Planned Spend Field | `Custom.TotalPlannedSpend` |
| Budget Remaining Field | `Custom.TotalBudgetRemaining` |
| Percent of Budget Field | `Custom.PercentOfBudget` |
| Currency Field | `Custom.Currency` |

### 5. Open any PMO Epic

Click the **Budget** tab, add fiscal year columns, enter quarterly amounts, and the summary updates in real time.

---

## Portfolio reporting

Because computed values are written to native Epic decimal fields, you can query them directly in WIQL without any external tooling:

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

Save this as a **Work Item Query Chart** widget on your Azure DevOps dashboard for at-a-glance portfolio budget health.

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

- [ ] Actuals columns (Q1 to Q4 Actual vs Planned variance per fiscal year)
- [ ] Export budget table to CSV
- [ ] Portfolio rollup dashboard widget to aggregate spend across Epics
- [ ] Lock rows by Epic state (read-only when Approved)
- [ ] Jest unit tests for core financial computation

See [open issues](https://github.com/deenuy/ado-epic-budget-data-table/issues) to pick something up.

---

## Contributing

Contributions of all sizes are welcome, from fixing a typo to building a roadmap feature.

Read the [Contributing Guide](CONTRIBUTING.md) to get started.

---

## License

[MIT](LICENSE). Free to use, modify, and distribute.

---

## Author

Built by **Deenu Gengiti**

If this saves your team time:
*   Star the repo. It helps others find it.
*   Leave a review on the [VS Marketplace](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-epic-budget-data-table)
*   File issues. Every bug report makes the extension better.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin)](https://linkedin.com/in/deenuy)
