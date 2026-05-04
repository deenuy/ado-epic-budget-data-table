# Stop Managing Programs/ Projects in Excel - Meet the Azure DevOps Epic Budget Table

Most portfolio leaders face the same frustrating problem: delivery teams manage their work in Azure DevOps, but budget planning and spend tracking live somewhere else. 

Excel files, SharePoint lists, and slide decks become the system of record for finance, while Azure DevOps remains the system of record for execution. When the two inevitably drift apart, traceability breaks, and leadership wastes valuable time reconciling numbers instead of making decisions.

Budget governance typically fails for one simple reason: **budget data is not where the decisions are made.**

To solve this, I built the **ADO Epic Budget Table**—a free extension that brings financial planning directly into the place where the work already lives.

[**Get it free on the Visual Studio Marketplace**](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-epic-budget-data-table) | [**View the source on GitHub**](https://github.com/deenuy/ado-epic-budget-data-table)

## What is the ADO Epic Budget Table?

The extension adds a dedicated **Budget tab** directly to your Azure DevOps Epics. It allows teams to plan spend by Fiscal Year and Quarter (Q1–Q4), see budget health instantly, and store computed totals back into queryable Epic fields for portfolio-level views.

![Budget Plan Table](pasted_file_P2rsme_image.png)
*Plan spend across Q1-Q4 for each fiscal year in a single, structured view.*

### 1. A Structured Budget Table Inside the Epic
Instead of maintaining a separate spreadsheet, teams enter planned spend for each fiscal year across Q1–Q4 directly within the Epic. It feels like a spreadsheet, but it stays connected to the delivery work.

### 2. Instant Budget Health Visibility
As quarterly numbers are entered, the extension automatically updates a summary banner showing:
*   **Approved Budget**
*   **Total Committed Spend**
*   **Remaining Budget**
*   **Percent of Budget Consumed**

Over-budget Epics are flagged immediately with the exact overage amount, making budget health visible without exporting data or manually calculating totals.

### 3. Portfolio Reporting Without Power BI
The most powerful feature is under the hood: computed values are written directly into **native numeric Epic fields** on every save. 

This means leadership can get portfolio-level budget views using standard Azure DevOps WIQL queries and dashboard widgets. You don't need a separate reporting stack, Power BI model, or Power Automate flows. 

For example, you can easily query:
*   “Which Epics are spending in FY26?”
*   “What is the total planned spend for FY27 across all approved Epics?”
*   “Which Epics are above 90% budget consumed?”

## A Simple Executive Use Case

**The Scenario: Quarterly Portfolio Review**

**Before:** The PMO exports a spreadsheet from multiple sources. Teams email updated budget numbers. Leadership reviews stale totals and spends the meeting asking for data corrections.

**After:** Teams update their budget plans directly in the Epic's Budget tab. Totals are computed and saved into Epic fields automatically. A portfolio dashboard in Azure DevOps instantly shows total planned spend by fiscal year, Epics at risk (e.g., ≥ 90% consumed), and over-budget Epics. Leadership reviews the dashboard and focuses on strategic decisions, not data cleanup.

## How to Set It Up

Implementation is intentionally lightweight and uses standard Azure DevOps configuration. All computation runs in the browser, and data is stored securely in your Azure DevOps fields.

**Step 1: Install the extension**
Grab it from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-epic-budget-data-table).

**Step 2: Create the Epic fields**
In your Organization Settings, add a few custom fields to your PMO Epic:
*   A JSON storage field for the table data (Text - multiple lines)
*   Numeric fields for computed totals (Decimal)
*   An existing “Approved Budget” field (like Estimated Cost)

![Custom Fields](pasted_file_Sz48WQ_image.png)

**Step 3: Add the control to the Epic form**
Open your process layout, create a new page called "Budget", and add the **ADO Epic Budget Table** custom control.

![Add Custom Control](pasted_file_uWUp0r_image.png)

**Step 4: Configure the mapping**
Map your custom fields in the control options so the extension knows where to store the table data and computed totals.

![Configure Options](pasted_file_I8XGmu_image.png)

## Why This Beats Spreadsheets

*   **Single source of truth:** The budget plan is part of the Epic record.
*   **Always current:** Totals update immediately when the Epic is updated.
*   **Portfolio ready:** Stored numeric fields support native queries and dashboards.
*   **Low overhead:** No external databases, no extra licensing costs.

If your PMO manages budget approvals at the Epic level, or if you run multi-year programs where the timing of spend matters, this extension will save you hours of manual reconciliation.

**Try it out today:**
👉 [Install from the Marketplace](https://marketplace.visualstudio.com/items?itemName=deenuy.ado-epic-budget-data-table)
👉 [Contribute on GitHub](https://github.com/deenuy/ado-epic-budget-data-table)

*If this saves your team time, please consider starring the GitHub repo or leaving a review on the Marketplace!*

# Recommended Tags
`Azure DevOps`, `Project Management`, `PMO`, `Agile`, `Budgeting`, `Software Engineering`

