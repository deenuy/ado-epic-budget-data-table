<div align="center">

# 📊 ADO Epic Budget Table

**Financial budget planning  built directly into Azure DevOps Epic work items.**

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/deenuy.ado-epic-budget-data-table?label=Marketplace&color=0078d4)](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-epic-budget-data-table)
[![GitHub Stars](https://img.shields.io/github/stars/deenuy/ado-epic-budget-data-table?style=flat&color=ffd700)](https://github.com/deenuy/ado-epic-budget-data-table/stargazers)
[![Build](https://github.com/deenuy/ado-epic-budget-data-table/actions/workflows/ci.yml/badge.svg)](https://github.com/deenuy/ado-epic-budget-data-table/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[**Install from Marketplace**](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-epic-budget-data-table) · [**Quick Start**](#quick-start) · [**Contribute**](CONTRIBUTING.md)

</div>

---

## The problem

Project managers in Azure DevOps have no native way to plan and track budget spend by **fiscal year and quarter** on an Epic. The typical workarounds  Excel files, SharePoint lists, Power BI datasets  live outside the work item, break traceability, and require separate maintenance.

This extension puts a full budget planning table **directly on the Epic's Financials tab**, auto-computes your financial KPIs, and writes results to **queryable Epic decimal fields**  so WIQL queries, dashboards, and backlog rollups reflect real budget data with no external tooling.

---

## What you get

| Feature | Detail |
|---|---|
| **Editable budget grid** | One row per cost line  Fiscal Year, Cost Category, Expense Type (CapEx/OpEx), Q1-Q4 amounts, Notes |
| **Financial summary banner** | Approved Budget · Total Planned Spend · Remaining · % of Budget with a RAG colour-coded progress bar |
| **Footer totals** | Per-quarter sums + grand total, always in sync as you type |
| **Auto-save** | Rows persist to a backing Epic field on a 300ms debounce  no Save button required |
| **Field writeback** | Computed KPIs written to native Epic decimal fields, making them queryable via WIQL |
| **Light / dark mode** | Respects Azure DevOps theme automatically |
| **No Power BI. No Power Automate. No external databases.** | |

---

## Quick Start

### 1  Install the extension

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-epic-budget-data-table).

### 2  Create Epic fields

In **Organization Settings → Process → [Your Process] → Epic**, create:

| Field Name | Type | Reference Name |
|---|---|---|
| Financials Table JSON | Text (multiple lines) | `Custom.FinancialsTableJson` |
| Total Planned Spend | Decimal | `Custom.TotalPlannedSpend` |
| Budget Remaining | Decimal | `Custom.BudgetRemaining` |
| Percent of Budget | Decimal | `Custom.PercentOfBudget` |

> **Tip:** Reuse your existing **Estimated Cost** or **Approved Budget** field as the approved budget source  no new field needed.

### 3  Add a Financials page to the Epic layout

1. **Organization Settings → Process → [Your Process] → Epic**
2. Click **New page** → name it `Financials`
3. Click **Add custom control** → select **ADO Epic Budget Table**

### 4  Configure the control options

| Input | Value |
|---|---|
| JSON Storage Field | `Custom.FinancialsTableJson` |
| Approved Budget Field | *(reference name of your Estimated Cost field)* |
| Total Planned Spend Field | `Custom.TotalPlannedSpend` |
| Budget Remaining Field | `Custom.BudgetRemaining` |
| Percent of Budget Field | `Custom.PercentOfBudget` |

### 5  Open any Epic → Financials tab

Add rows, enter quarterly amounts, watch the summary update live.

---

## Querying budget data (no Power BI needed)

Because computed values are written to native Epic decimal fields, you can query them in WIQL:

```sql
SELECT [System.Id], [System.Title],
       [Custom.TotalPlannedSpend],
       [Custom.BudgetRemaining],
       [Custom.PercentOfBudget]
FROM WorkItems
WHERE [System.WorkItemType] = 'Epic'
  AND [Custom.PercentOfBudget] >= 90
ORDER BY [Custom.PercentOfBudget] DESC
```

Use this as a **Work Item Query Chart** widget on your Azure DevOps dashboard  no additional tooling required.

---

## Local development

```bash
git clone https://github.com/deenuy/ado-epic-budget-data-table.git
cd ado-epic-budget-data-table
npm install
npm run build       # production bundle → dist/
npm run dev         # watch mode
npm run package     # creates .vsix for manual upload
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide.

---

## Roadmap

- [ ] Multi-currency support with per-row currency selector
- [ ] Actuals columns (Q1-Q4 Actual vs Planned variance)
- [ ] Export budget table to CSV
- [ ] Portfolio dashboard widget  aggregate across Epics via WIQL
- [ ] Lock rows by Epic state (read-only when Approved)
- [ ] Jest unit tests for `computeFinancials`

See [open issues](https://github.com/deenuy/ado-epic-budget-data-table/issues) to pick something up.

---

## Contributing

Contributions of all sizes are welcome  from fixing a typo to building a roadmap feature.

Read the **[Contributing Guide](CONTRIBUTING.md)** to get started.

---

## License

[MIT](LICENSE)  free to use, modify, and distribute.

---

## Author

Built by **Deenu Gengiti**

If this saves your team time:
- ⭐ **Star this repo**  helps others find it
- 📝 **Leave a review** on the [VS Marketplace](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-epic-budget-data-table)
- 🐛 **File issues**  every bug report makes the extension better

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin)](https://linkedin.com/in/deenu-gengiti)