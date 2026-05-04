/**
 * ADO Epic Budget Table — Azure DevOps Work Item Form Control
 * ─────────────────────────────────────────────────────────────
 * Renders a transposed budget planning grid inside PMO Epic work items.
 *
 * Layout: Fixed rows = Q1 / Q2 / Q3 / Q4. Dynamic columns = Fiscal Years.
 *         Adding a fiscal year appends a column. Deleting removes the column.
 *         FY totals are shown in the footer row per column.
 *
 * Data model: One BudgetRow per fiscal year stored as a JSON array in a
 *             PlainText Epic field (Custom.FinancialsTableJson). The storage
 *             format is intentionally row-per-FY — the transposition is purely
 *             a rendering concern and does not affect the persisted structure.
 *
 * Computed fields: The extension writes three values back to queryable Epic
 *                  decimal fields after every save so they are available in
 *                  WIQL queries and dashboard widgets without Power BI.
 *
 * Extension inputs (configured in the control Options panel):
 *   DataFieldRefName      — PlainText field for JSON storage
 *   ApprovedBudgetFieldRef — Decimal field to READ Estimated Cost from
 *   TotalSpentFieldRef     — Decimal field to WRITE total planned spend
 *   BudgetRemainingFieldRef — Decimal field to WRITE remaining budget
 *   PercentSpentFieldRef   — Decimal field to WRITE % of budget used
 */

import * as SDK from "azure-devops-extension-sdk";
import {
  IWorkItemFormService,
  WorkItemTrackingServiceIds,
} from "azure-devops-extension-api/WorkItemTracking";

import "./styles.css";

/* ─────────────────────────────── Constants ─────────────────────────────── */

/** Set to true during local development to enable verbose console logging. */
const DEBUG = false;

/**
 * Ordered list of all supported fiscal years.
 * Order determines column sequence and next-FY logic.
 * Extend this list when planning beyond FY40.
 */
const ALL_FISCAL_YEARS = [
  "FY25","FY26","FY27","FY28","FY29","FY30",
  "FY31","FY32","FY33","FY34","FY35","FY36",
  "FY37","FY38","FY39","FY40",
];

/** Quarter field keys — must match BudgetRow interface property names. */
const QUARTERS: Array<keyof Pick<BudgetRow,"q1"|"q2"|"q3"|"q4">> = ["q1","q2","q3","q4"];

/** Display labels for quarter rows in the transposed table. */
const QUARTER_LABELS = ["Q1 ($)","Q2 ($)","Q3 ($)","Q4 ($)"];

/* ─────────────────────────────── Types ─────────────────────────────── */

/** One budget row per fiscal year. Stored as JSON array in Custom.FinancialsTableJson. */
interface BudgetRow {
  _id:        number;   // Internal row identifier — not displayed
  fiscalYear: string;   // e.g. "FY26"
  q1:         number;   // Q1 spend amount in dollars
  q2:         number;
  q3:         number;
  q4:         number;
  notes:      string;   // Retained for backward compatibility — not shown in transposed layout
}

/** Computed financial summary derived from all BudgetRows and the approved budget. */
interface FinancialSummary {
  totalPlannedSpend: number;  // Sum of all Q1–Q4 across all fiscal years
  budgetRemaining:   number;  // approvedBudget - totalPlannedSpend
  percentSpent:      number;  // (totalPlannedSpend / approvedBudget) * 100, or 0 if no budget
  approvedBudget:    number;  // Value read from the Estimated Cost field
}

/** Extension configuration resolved from the control Options panel (witInputs). */
interface ExtensionConfig {
  dataFieldRef:            string;        // Required — PlainText field for JSON storage
  approvedBudgetFieldRef:  string | null; // Optional — decimal field to read budget from
  totalSpentFieldRef:      string | null; // Optional — decimal field to write total spend
  budgetRemainingFieldRef: string | null; // Optional — decimal field to write remaining
  percentSpentFieldRef:    string | null; // Optional — decimal field to write % spent
  /** Optional — Picklist/Text field holding the ISO currency code (e.g. USD, EUR, GBP). */
  currencyFieldRef:        string | null;
}

/* ─────────────────────────────── Module state ─────────────────────────────── */

/** AzDO SDK work item form service — available after onLoaded resolves. */
let workItemService: IWorkItemFormService | null = null;

/** Auto-incrementing row ID used when creating new BudgetRows. */
let nextId = 1;

/**
 * When true, input/change events on the table do not trigger markDirty().
 * Set to true during renderTable() to prevent the initial DOM population from
 * being treated as user edits. Released via a 500ms timeout after render.
 */
let suppressDirty = false;

/**
 * Counter used to absorb SDK onFieldChanged echo events caused by the
 * extension's own setFieldValue calls. Incremented before each write,
 * decremented when the echo arrives in onFieldChanged.
 * Prevents reloading data after our own saves.
 */
let skipFieldChangeOnce = 0;

/** Last JSON payload written to the storage field. Used to skip redundant writes. */
let lastWrittenPayload: string | null = null;

/**
 * Last successfully read value of the approved budget field.
 * Returned as a fallback if subsequent reads fail (e.g., transient SDK error).
 */
let cachedApprovedBudget = 0;

/**
 * In-memory representation of current fiscal year rows.
 * Used by getRowsFromTable() as the source of truth for row identity (_id, fiscalYear)
 * when reading values back from the transposed DOM.
 */
let currentRows: BudgetRow[] = [];

/** Prevents duplicate listener wiring if onLoaded fires more than once. */
let initialized = false;

/**
 * ISO 4217 currency code resolved from Custom.Currency at load time.
 * Defaults to USD. Used to format all monetary values in the banner and table.
 */
let activeCurrencyCode = "USD";

/** Active extension configuration. Populated in onLoaded from SDK witInputs. */
let config: ExtensionConfig = {
  dataFieldRef:            "Custom.FinancialsTableJson",
  approvedBudgetFieldRef:  null,
  totalSpentFieldRef:      null,
  budgetRemainingFieldRef: null,
  percentSpentFieldRef:    null,
  currencyFieldRef:        null,
};

/* ─────────────────────────────── Logging ─────────────────────────────── */

/** Verbose logging — only active when DEBUG = true. Use for tracing normal flow. */
function log(...a: any[])  { if (DEBUG) console.log("[FIN]", ...a); }

/** Always-visible warning — use for errors and unexpected states in production. */
function warn(...a: any[]) { console.warn("[FIN]", ...a); }

/* ─────────────────────────────── Configuration ─────────────────────────────── */

/**
 * Reads extension inputs from the SDK configuration (Options panel).
 * Falls back to safe defaults when inputs are missing or empty.
 * Called once in onLoaded before any SDK field operations.
 */
function readConfig(): ExtensionConfig {
  const cfg = (SDK.getConfiguration() as any)?.witInputs ?? {};
  return {
    dataFieldRef:            (cfg.DataFieldRefName ?? "Custom.FinancialsTableJson").trim(),
    approvedBudgetFieldRef:  cfg.ApprovedBudgetFieldRef?.trim()  || null,
    totalSpentFieldRef:      cfg.TotalSpentFieldRef?.trim()      || null,
    budgetRemainingFieldRef: cfg.BudgetRemainingFieldRef?.trim() || null,
    percentSpentFieldRef:    cfg.PercentSpentFieldRef?.trim()    || null,
    currencyFieldRef:        cfg.CurrencyFieldRef?.trim()         || null,
  };
}

/* ─────────────────────────────── HTML helpers ─────────────────────────────── */

/** Escapes a string for safe inclusion in HTML attributes and content. */
function esc(s: string): string {
  return String(s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
}

/**
 * Reverses HTML entity encoding.
 * Needed when reading field values that AzDO may return as encoded HTML strings.
 */
function decodeHtml(s: string): string {
  return s
      .replace(/&quot;/g,'"').replace(/&#39;/g,"'")
      .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");
}

/**
 * Strips HTML tags and normalises non-breaking spaces.
 * AzDO sometimes wraps PlainText field values in HTML when reading via SDK.
 */
function stripTags(s: string): string {
  return s.replace(/<\/?[^>]+>/g,"").replace(/\u00A0/g," ").trim();
}

/**
 * Extracts the outermost JSON array from a string.
 * Handles cases where the stored value has been wrapped in HTML by AzDO.
 */
function extractJsonArray(s: string): string | null {
  const start = s.indexOf("[");
  const end   = s.lastIndexOf("]");
  return (start !== -1 && end > start) ? s.slice(start, end + 1) : null;
}

/* ─────────────────────────────── Status bar ─────────────────────────────── */

/** Updates the status text shown next to the Save button in the control header. */
function setStatus(msg: string): void {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
  log("STATUS:", msg);
}

/* ─────────────────────────────── Financial calculations ─────────────────────────────── */

/**
 * Pure function — derives all financial KPIs from row data and approved budget.
 * No side effects. Safe to call at any point.
 *
 * @param rows - Current BudgetRows (any order, uses all Q1–Q4 values)
 * @param approvedBudget - Value read from the Estimated Cost field (0 = not set)
 */
function computeFinancials(rows: BudgetRow[], approvedBudget: number): FinancialSummary {
  const totalPlannedSpend = rows.reduce(
      (sum, r) =>
          sum + (Number(r.q1)||0) + (Number(r.q2)||0) + (Number(r.q3)||0) + (Number(r.q4)||0),
      0
  );
  const budgetRemaining = approvedBudget - totalPlannedSpend;
  const percentSpent    = approvedBudget > 0
      ? Math.round((totalPlannedSpend / approvedBudget) * 10000) / 100
      : 0;
  return { totalPlannedSpend, budgetRemaining, percentSpent, approvedBudget };
}

/** Cached number formatter — avoids re-creating Intl internals on every call. */
const NF0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Formats an integer as a US locale number string (e.g. 1234567 → "1,234,567"). */
function fmt(n: number): string { return NF0.format(n); }

/** Formats a number as a currency string using the active ISO currency code. */
function fmtCurrency(n: number): string {
  const sym = currencySymbol(activeCurrencyCode);
  return (n < 0 ? `-${sym}` : sym) + fmt(Math.abs(n));
}

/**
 * Reads the currency code from the configured field (default: Custom.Currency).
 * Falls back to "USD" if the field is not configured, empty, or unreadable.
 * Called once in onLoaded and cached in activeCurrencyCode for the session.
 */
async function readCurrency(): Promise<void> {
  if (!workItemService) return;
  const ref = config.currencyFieldRef ?? "Custom.Currency";
  try {
    const values = await workItemService.getFieldValues([ref]);
    const val    = values[ref];
    if (val && typeof val === "string" && val.trim()) {
      activeCurrencyCode = val.trim().toUpperCase();
      log("readCurrency: resolved", ref, "=", activeCurrencyCode);
    }
  } catch {
    log("readCurrency: field not found or unreadable:", ref, "— defaulting to USD");
  }
}

/**
 * Returns the currency symbol for an ISO 4217 code.
 * Covers common currencies encountered in global enterprise PMO contexts.
 * Falls back to the code itself (e.g. "CHF") for unlisted currencies.
 *
 * @param code - ISO 4217 currency code (e.g. "USD", "EUR")
 */
function currencySymbol(code: string): string {
  const symbols: Record<string, string> = {
    USD: "$",   CAD: "CA$", AUD: "A$",  NZD: "NZ$",
    EUR: "€",   GBP: "£",   CHF: "CHF",
    JPY: "¥",   CNY: "¥",   HKD: "HK$", SGD: "S$",  KRW: "₩",
    INR: "₹",   BRL: "R$",  MXN: "MX$", ZAR: "R",
    SEK: "kr",  NOK: "kr",  DKK: "kr",
    AED: "AED", SAR: "SAR",
  };
  return symbols[code] ?? code;
}

/* ─────────────────────────────── Summary banner ─────────────────────────────── */

/**
 * Renders the financial summary banner above the table.
 * Shows Estimated Cost, Total Planned Spend, Remaining, and % of Budget.
 * RAG-colours the % metric: green < 75%, amber 75–90%, red > 90%.
 * When no approved budget is set, Remaining and % show "—" with a hint message.
 */
function renderSummary(summary: FinancialSummary): void {
  const el = document.getElementById("financialSummary");
  if (!el) return;

  const hasApproved = summary.approvedBudget > 0;
  const pct         = summary.percentSpent;
  const ragClass    = !hasApproved ? "rag-green"
      : pct > 90 ? "rag-red"
          : pct > 75 ? "rag-amber"
              : "rag-green";
  const barPct = hasApproved ? Math.min(pct, 100) : 0;

  // Progress bar hint — differentiate between on-track, at-risk, and over-budget states
  const progressLabel = !hasApproved
      ? "Configure an Approved Budget field in control Options to see % of budget"
      : summary.budgetRemaining < 0
          ? `Over budget by ${fmtCurrency(Math.abs(summary.budgetRemaining))}`
          : pct > 75
              ? `${pct.toFixed(1)}% of budget used — ${fmtCurrency(summary.budgetRemaining)} remaining`
              : `${pct.toFixed(1)}% of budget used`;

  el.innerHTML = `
    <div class="fin-metric">
      <span class="fin-label">Approved Budget</span>
      <span class="fin-value">${hasApproved ? fmtCurrency(summary.approvedBudget) : "Not set"}</span>
    </div>
    <div class="fin-metric">
      <span class="fin-label">Total Committed Spend</span>
      <span class="fin-value">${fmtCurrency(summary.totalPlannedSpend)}</span>
    </div>
    <div class="fin-metric">
      <span class="fin-label">Remaining</span>
      <span class="fin-value ${hasApproved && summary.budgetRemaining < 0 ? "rag-red" : ""}">
        ${hasApproved ? fmtCurrency(summary.budgetRemaining) : "—"}
      </span>
    </div>
    <div class="fin-metric ${hasApproved ? ragClass : ""}">
      <span class="fin-label">% of Budget</span>
      <span class="fin-value">${hasApproved ? pct.toFixed(1) + "%" : "—"}</span>
    </div>
    <div class="fin-progress-wrap">
      <div class="fin-progress-bar">
        <div class="fin-progress-fill ${ragClass}" style="width:${barPct}%"></div>
      </div>
      <span class="fin-progress-label ${ragClass}">${progressLabel}</span>
    </div>
  `;
  el.style.display = "flex";
}

/* ─────────────────────────────── Fiscal year helpers ─────────────────────────────── */

/** Returns fiscal years not yet used by any existing row, in ALL_FISCAL_YEARS order. */
function availableFiscalYears(rows: BudgetRow[]): string[] {
  const used = new Set(rows.map(r => r.fiscalYear));
  return ALL_FISCAL_YEARS.filter(fy => !used.has(fy));
}

/**
 * Returns the next fiscal year to default to when adding a new column.
 * Picks the first available year sequentially after the highest currently used year.
 * Falls back to the first available year if sequential continuation is not possible.
 */
function nextFiscalYear(rows: BudgetRow[]): string {
  const available = availableFiscalYears(rows);
  if (available.length === 0) return ALL_FISCAL_YEARS[ALL_FISCAL_YEARS.length - 1];
  if (rows.length === 0) return available[0];
  const maxUsedIdx    = Math.max(...rows.map(r => ALL_FISCAL_YEARS.indexOf(r.fiscalYear)));
  const nextInSequence = ALL_FISCAL_YEARS.slice(maxUsedIdx + 1).find(fy => available.includes(fy));
  return nextInSequence ?? available[0];
}

/* ─────────────────────────────── Transposed table rendering ─────────────────────────────── */


/**
 * Wires a single set of delegated event handlers on #tableWrap.
 * Called once — subsequent renderTable() calls reuse these handlers.
 * Delegation avoids attaching per-cell listeners (up to 144 per render).
 *
 * @param wrap - The #tableWrap container element
 */
function wireTableEventsOnce(wrap: HTMLElement): void {
  if (tableEventsWired) return;
  tableEventsWired = true;

  // Single input handler covers all .num-input cells
  wrap.addEventListener("input", (ev) => {
    if (suppressDirty) return;
    const t = ev.target as HTMLElement | null;
    if (!(t instanceof HTMLInputElement) || !t.classList.contains("num-input")) return;
    const fy = t.dataset["fy"];
    if (fy) updateFYTotal(fy);
    markDirty();
  });

  // Blur (change) handler refreshes the summary banner after user leaves a cell
  wrap.addEventListener("change", (ev) => {
    if (suppressDirty) return;
    const t = ev.target as HTMLElement | null;
    if (t instanceof HTMLInputElement && t.classList.contains("num-input")) {
      void refreshSummary();
    }
  });

  // Single click handler covers all Delete buttons via closest() traversal
  wrap.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement | null;
    const btn = t?.closest?.("button.btn-remove") as HTMLButtonElement | null;
    if (!btn) return;
    const fy = btn.dataset["fy"];
    if (fy) removeFiscalYear(fy);
  });
}

/**
 * Renders the full transposed budget table into #tableWrap.
 * Table structure: thead = FY headers + Delete buttons, tbody = 4 quarter rows,
 * tfoot = FY total per column.
 *
 * Wires input events to markDirty() and delete buttons to removeFiscalYear().
 * Sets suppressDirty = true during render and releases after 500ms to prevent
 * the initial DOM population from triggering auto-save.
 *
 * @param rows - Rows to render. Will be sorted ascending by fiscal year internally.
 */
function renderTable(rows: BudgetRow[]): void {
  suppressDirty = true;

  const sorted = [...rows].sort(
      (a, b) => ALL_FISCAL_YEARS.indexOf(a.fiscalYear) - ALL_FISCAL_YEARS.indexOf(b.fiscalYear)
  );
  currentRows = sorted; // Persist for getRowsFromTable() DOM reads

  const wrap = document.getElementById("tableWrap");
  if (!wrap) {
    warn("renderTable: #tableWrap not found in DOM");
    return;
  }

  // Empty state
  if (sorted.length === 0) {
    wrap.innerHTML = `<p class="no-rows-msg">No fiscal years added yet. Click Add FY to start.</p>`;
    setTimeout(() => { suppressDirty = false; }, 500);
    return;
  }

  let html = `<table class="azdo-table transposed-table" id="gridTable">`;

  // ── Header: FY column labels ──
  html += `<thead><tr><th class="row-label-cell"></th>`;
  for (const row of sorted) {
    html += `<th class="fy-header">${esc(row.fiscalYear)}</th>`;
  }
  html += `</tr>`;

  // ── Delete row: one button per FY column in the header ──
  html += `<tr class="delete-row"><td class="row-label-cell"></td>`;
  for (const row of sorted) {
    html += `<td>
      <button class="azdo-btn btn-remove" data-fy="${esc(row.fiscalYear)}" type="button"
        aria-label="Delete ${esc(row.fiscalYear)}">Delete</button>
    </td>`;
  }
  html += `</tr></thead>`;

  // ── Body: 4 fixed rows — Q1 through Q4 ──
  html += `<tbody>`;
  for (let qi = 0; qi < QUARTERS.length; qi++) {
    const q   = QUARTERS[qi];
    const lbl = QUARTER_LABELS[qi];
    html += `<tr><td class="row-label-cell"><strong>${esc(lbl)}</strong></td>`;
    for (const row of sorted) {
      const val = Number(row[q]) || 0;
      // data-fy and data-q used by getRowsFromTable() to read values back from DOM
      html += `<td>
        <input class="num-input" type="number" min="0" step="1000"
          data-fy="${esc(row.fiscalYear)}" data-q="${q}"
          value="${val}"
          aria-label="${esc(row.fiscalYear)} ${esc(lbl)}" />
      </td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody>`;

  // ── Footer: computed FY total per column ──
  html += `<tfoot><tr class="totals-row"><td class="row-label-cell"><strong>FY TOTAL</strong></td>`;
  for (const row of sorted) {
    const total = (Number(row.q1)||0) + (Number(row.q2)||0) + (Number(row.q3)||0) + (Number(row.q4)||0);
    // data-fy used by updateFYTotal() to target the correct cell on keystroke
    html += `<td class="num-cell fy-total" data-fy="${esc(row.fiscalYear)}">
      <strong>${fmtCurrency(total)}</strong>
    </td>`;
  }
  html += `</tr></tfoot></table>`;

  wrap.innerHTML = html;

  // Wire all input and click events via a single delegated handler (attached once)
  wireTableEventsOnce(wrap);

  resizeIframe();
  // Clear any prior suppress timer before setting new one — prevents races between rapid renders
  window.clearTimeout(suppressTimer);
  suppressTimer = window.setTimeout(() => { suppressDirty = false; }, 500);
}

/**
 * Updates the FY total footer cell for a single column.
 * Called on every keystroke (input event) so the total is always current
 * without needing a full re-render.
 *
 * @param fy - Fiscal year identifier (e.g. "FY26")
 */
function updateFYTotal(fy: string): void {
  const inputs = document.querySelectorAll<HTMLInputElement>(`input.num-input[data-fy="${fy}"]`);
  let total = 0;
  inputs.forEach(inp => { total += Number(inp.value) || 0; });
  const cell = document.querySelector<HTMLElement>(`.fy-total[data-fy="${fy}"]`);
  if (cell) cell.textContent = fmtCurrency(total); // textContent is safer than innerHTML for plain numbers
}

/* ─────────────────────────────── DOM → data reader ─────────────────────────────── */

/**
 * Reads current input values from the transposed DOM and returns a BudgetRow array.
 * Uses currentRows as the source of truth for row identity (_id, fiscalYear) since
 * the transposed layout does not have a row-per-FY structure — FYs are columns.
 * Falls back to the stored value in currentRows when a DOM input is not found.
 *
 * Always returns rows sorted ascending by fiscal year.
 */
function getRowsFromTable(): BudgetRow[] {
  if (!currentRows.length) return [];

  const rows: BudgetRow[] = currentRows.map(template => {
    const fy  = template.fiscalYear;
    const row: BudgetRow = {
      _id:        template._id,
      fiscalYear: fy,
      q1: 0, q2: 0, q3: 0, q4: 0,
      notes: "",
    };
    for (const q of QUARTERS) {
      const inp = document.querySelector<HTMLInputElement>(
          `input.num-input[data-fy="${fy}"][data-q="${q}"]`
      );
      // If DOM input exists read live value; otherwise fall back to stored value
      row[q] = inp ? (Number(inp.value) || 0) : (Number(template[q]) || 0);
    }
    return row;
  });

  return rows.sort(
      (a, b) => ALL_FISCAL_YEARS.indexOf(a.fiscalYear) - ALL_FISCAL_YEARS.indexOf(b.fiscalYear)
  );
}

/* ─────────────────────────────── Add / Remove fiscal year ─────────────────────────────── */

/**
 * Adds the next available fiscal year as a new column.
 * Defaults to the year immediately following the highest currently used year.
 * Shows a status message and returns early if all fiscal years are already added.
 */
function addFiscalYear(): void {
  const rows      = getRowsFromTable();
  const available = availableFiscalYears(rows);
  if (available.length === 0) {
    setStatus("All fiscal years have been added.");
    setTimeout(() => setStatus("Ready"), 3000);
    return;
  }
  const nextFY = nextFiscalYear(rows);
  const newRow: BudgetRow = {
    _id: nextId++, fiscalYear: nextFY,
    q1: 0, q2: 0, q3: 0, q4: 0, notes: "",
  };
  currentRows = [...rows, newRow].sort(
      (a, b) => ALL_FISCAL_YEARS.indexOf(a.fiscalYear) - ALL_FISCAL_YEARS.indexOf(b.fiscalYear)
  );
  renderTable(currentRows);
  if (!suppressDirty) {
    void refreshSummary();
    markDirty();
  }
}

/**
 * Removes the specified fiscal year column.
 * Reads current DOM values before removal so no edits in other columns are lost.
 *
 * @param fy - Fiscal year to remove (e.g. "FY26")
 */
function removeFiscalYear(fy: string): void {
  // Read current DOM values first to preserve edits in remaining columns
  const rows = getRowsFromTable().filter(r => r.fiscalYear !== fy);
  currentRows = rows;
  renderTable(rows);
  if (!suppressDirty) {
    refreshSummary();
    markDirty();
    resizeIframe();
  }
}

/* ─────────────────────────────── Summary refresh ─────────────────────────────── */

/**
 * Re-reads all values from the DOM, recomputes financials, and updates the
 * summary banner. Called after cell blur events and after add/remove operations.
 */
async function refreshSummary(): Promise<void> {
  const rows     = getRowsFromTable();
  const approved = await readApprovedBudget();
  const summary  = computeFinancials(rows, approved);
  renderSummary(summary);
}

/* ─────────────────────────────── Approved budget field ─────────────────────────────── */

/**
 * Reads the approved budget (Estimated Cost) from the configured Epic decimal field.
 *
 * Resolution order:
 *   1. config.approvedBudgetFieldRef (set via Options panel, e.g. "Custom.EstimatedCost")
 *   2. Hard-coded fallback "Custom.EstimatedCost" when config is null
 *
 * Guards against null/undefined/"" returns from getFieldValue — the AzDO SDK can
 * return null for fields that have never been explicitly saved on a work item.
 * Number(null) = 0 which passes !isNaN, so the null check must come first.
 *
 * On success: caches the value and locks in the working field ref for the session.
 * On failure: returns the last cached value so the banner does not reset to $0.
 *
 * @returns Approved budget amount in dollars, or 0 if not set.
 */
async function readApprovedBudget(): Promise<number> {
  if (!workItemService) return cachedApprovedBudget;

  const candidates = Array.from(new Set([
    config.approvedBudgetFieldRef ?? "Custom.EstimatedCost",
  ]));

  for (const candidate of candidates) {
    try {
      const val = await workItemService.getFieldValue(candidate, false);

      // Explicit null/undefined/empty guard — Number(null)=0 passes !isNaN,
      // which would silently treat an unset field as $0 approved budget
      if (val === null || val === undefined || val === "") {
        log("readApprovedBudget: field returned empty for", candidate);
        continue;
      }

      const n = Number(val);
      if (!isNaN(n)) {
        log("readApprovedBudget: resolved", candidate, "=", n);
        cachedApprovedBudget        = n;
        config.approvedBudgetFieldRef = candidate; // Lock in for session
        return n;
      }
    } catch (e) {
      // Field does not exist on this WIT or read access denied
      warn("readApprovedBudget: getFieldValue failed for", candidate, e);
    }
  }

  warn("readApprovedBudget: no candidate returned a value. Tried:", candidates.join(", "));
  return cachedApprovedBudget; // Return last known value to avoid banner reset
}

/* ─────────────────────────────── Computed field writeback ─────────────────────────────── */

/**
 * Writes computed KPI values back to the three queryable Epic decimal fields.
 * Skips any field that is not configured (null ref = not wired in Options panel).
 * Increments skipFieldChangeOnce before each write to suppress the resulting
 * onFieldChanged echoes caused by our own setFieldValue calls.
 *
 * Writes all three values unconditionally — including 0 — to clear stale values
 * when the budget table is emptied or the approved budget is removed.
 *
 * @param summary - Computed financial summary to persist.
 */
async function writeComputedFields(summary: FinancialSummary): Promise<void> {
  if (!workItemService) return;

  const writes: Array<[string | null, number]> = [
    [config.totalSpentFieldRef,      summary.totalPlannedSpend],
    [config.budgetRemainingFieldRef, summary.budgetRemaining],
    [config.percentSpentFieldRef,    summary.percentSpent],
  ];

  const active = writes.filter(([f]) => !!f) as [string, number][];
  if (!active.length) return;

  // Pre-increment so onFieldChanged can absorb all echoes from this batch
  skipFieldChangeOnce += active.length;

  for (const [field, value] of active) {
    try {
      await workItemService.setFieldValue(field, value);
    } catch (e) {
      // Field write failed — decrement counter to avoid permanently suppressing future events
      skipFieldChangeOnce = Math.max(0, skipFieldChangeOnce - 1);
      warn(`writeComputedFields: setFieldValue failed for ${field}:`, e);
    }
  }
}

/* ─────────────────────────────── Auto-save (debounced) ─────────────────────────────── */

/** Handle for the pending debounce timer. Cleared by flushDirty() and on each new edit. */
let dirtyDebounce: number | undefined;

/** True while a save is in-flight. Prevents overlapping concurrent writes. */
let saving = false;

/** True when a save was requested while one was already in-flight. Triggers a follow-up save. */
let saveQueued = false;

/** Handle for the suppressDirty release timer. Cleared before each new render to prevent races. */
let suppressTimer: number | undefined;

/** Prevents re-attaching delegated table events on every renderTable() call. */
let tableEventsWired = false;

/**
 * Executes a single save operation: writes the JSON payload, recomputes
 * financials, updates the banner, and writes computed fields.
 * Enforces mutual exclusion via the `saving` flag — if called while a save
 * is in-flight, sets `saveQueued` so one follow-up save runs after completion.
 *
 * @param rows    - Current rows to persist
 * @param payload - JSON.stringify(rows) — pre-computed by caller
 */
async function runSave(rows: BudgetRow[], payload: string): Promise<void> {
  if (!workItemService) return;
  if (saving) { saveQueued = true; return; }
  saving = true;

  try {
    skipFieldChangeOnce++;
    const ok = await workItemService.setFieldValue(config.dataFieldRef, payload);
    lastWrittenPayload = payload;
    setStatus(ok ? "Pending changes..." : "Could not auto-save");

    const approved = await readApprovedBudget();
    const summary  = computeFinancials(rows, approved);
    renderSummary(summary);
    await writeComputedFields(summary);
  } catch (e: any) {
    setStatus("Auto-save error: " + (e?.message ?? String(e)));
    warn("runSave: error during save:", e);
  } finally {
    saving = false;
    // If a save was requested while we were busy, run one final save with latest state
    if (saveQueued) {
      saveQueued = false;
      const latestRows    = getRowsFromTable();
      const latestPayload = JSON.stringify(latestRows);
      if (latestPayload !== lastWrittenPayload) void runSave(latestRows, latestPayload);
    }
  }
}

/**
 * Cancels any pending debounce timer.
 * Called by saveToField() and onSaved() to ensure explicit saves capture the latest state.
 */
function flushDirty(): void {
  window.clearTimeout(dirtyDebounce);
}

/**
 * Schedules an auto-save 400ms after the last user edit.
 * Debounced — rapid keystrokes reset the timer rather than firing multiple saves.
 * Skips the write if the serialised rows are identical to the last written payload.
 * After a successful write, recomputes financials and updates the summary banner.
 */
function markDirty(): void {
  if (suppressDirty || !workItemService) return;
  window.clearTimeout(dirtyDebounce);
  dirtyDebounce = window.setTimeout(async () => {
    const rows    = getRowsFromTable();
    const payload = JSON.stringify(rows);
    if (payload !== lastWrittenPayload) void runSave(rows, payload);
  }, 400);
}

/* ─────────────────────────────── Explicit save ─────────────────────────────── */

/**
 * Handles the explicit Save button click.
 * Flushes any pending debounce first so the latest DOM state is captured.
 * Writes the JSON payload, recomputes financials, and updates computed fields.
 * Shows "Saved" status for 3 seconds then resets to "Ready".
 */
async function saveToField(): Promise<void> {
  if (!workItemService) return;
  flushDirty();
  const rows    = getRowsFromTable();
  const payload = JSON.stringify(rows);
  await runSave(rows, payload);
  setStatus("Saved");
  setTimeout(() => setStatus("Ready"), 3000);
}

/* ─────────────────────────────── Data load ─────────────────────────────── */

/**
 * Reads the JSON storage field and re-renders the table with persisted data.
 * Handles AzDO's tendency to wrap field values in HTML by stripping tags
 * before JSON parsing. Gracefully renders an empty table if the field is
 * empty or unparseable.
 *
 * suppressDirty is set to true before render and released by renderTable's
 * 500ms timeout — this function must not set a competing timer.
 */
async function loadFromField(): Promise<void> {
  if (!workItemService) return;
  suppressDirty = true;

  let rows: BudgetRow[] = [];
  try {
    let raw = await workItemService.getFieldValue(config.dataFieldRef, false);
    // Normalise: SDK may return null, a number, or a plain string
    if (typeof raw !== "string") raw = raw == null ? "" : String(raw);

    const text = stripTags(decodeHtml(raw as string));
    const json = extractJsonArray(text);
    if (json) {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        rows = parsed.map((p: any, i: number): BudgetRow => ({
          _id:        p._id        || i + 1,
          fiscalYear: p.fiscalYear || ALL_FISCAL_YEARS[0],
          q1:         Number(p.q1) || 0,
          q2:         Number(p.q2) || 0,
          q3:         Number(p.q3) || 0,
          q4:         Number(p.q4) || 0,
          notes:      p.notes      || "",
        }));
      }
    }
  } catch (e) {
    warn("loadFromField: failed to parse stored JSON:", e);
    // Render empty table — don't block the user from adding new rows
  }

  // Defensive validation: remove unrecognised FY strings and deduplicate
  // Protects against manual JSON edits, copy-paste corruption, and migration artifacts
  const seenFY = new Set<string>();
  rows = rows.filter(r => {
    if (!ALL_FISCAL_YEARS.includes(r.fiscalYear)) return false; // Unknown FY — discard
    if (seenFY.has(r.fiscalYear)) return false;                 // Duplicate — keep first
    seenFY.add(r.fiscalYear);
    return true;
  });

  rows.sort((a, b) => ALL_FISCAL_YEARS.indexOf(a.fiscalYear) - ALL_FISCAL_YEARS.indexOf(b.fiscalYear));
  renderTable(rows);

  const approved = await readApprovedBudget();
  const summary  = computeFinancials(rows, approved);
  renderSummary(summary);
  // suppressDirty released by renderTable's 500ms timer
}

/* ─────────────────────────────── iframe resize ─────────────────────────────── */

/**
 * Measures the actual rendered height of the #app container and passes it to
 * the AzDO SDK resize method. This overrides the static height from the
 * process layout definition, ensuring the iframe fits the content after every
 * render, row add/remove, and work item save.
 */
function resizeIframe(): void {
  const h = document.getElementById("app")?.scrollHeight ?? 400;
  SDK.resize(undefined, h);
}

/* ─────────────────────────────── Field probe ─────────────────────────────── */

/**
 * Verifies a storage field is readable by the current user.
 * Tries the configured reference name plus common casing variants
 * (Json ↔ JSON) to handle common naming inconsistencies.
 * Returns the first variant that resolves, or null if all fail.
 * Does NOT write to the field — write tests would mark the work item dirty.
 *
 * @param svc - Work item form service
 * @param ref - Field reference name to probe
 */
async function probeField(
    svc: IWorkItemFormService,
    ref: string
): Promise<string | null> {
  const variants = [
    ref,
    ref.replace(/Json$/, "JSON"),
    ref.replace(/JSON$/, "Json"),
  ];
  for (const f of variants) {
    try {
      await svc.getFieldValue(f, false);
      return f;
    } catch {
      // Field not found or no read access — try next variant
    }
  }
  return null;
}

/* ─────────────────────────────── SDK provider ─────────────────────────────── */

/**
 * Registers the work item form control provider with the AzDO SDK.
 * The provider object exposes lifecycle hooks that the form calls at defined points.
 */
const provider = () => ({

  /**
   * Called once when the work item form loads or the control is first shown.
   * Initialises configuration, wires the service, validates field access,
   * loads persisted data, and resizes the iframe to fit content.
   */
  onLoaded: async () => {
    // Guard against duplicate wiring if the control is re-mounted in the same session
    if (initialized) { await loadFromField(); resizeIframe(); return; }
    initialized = true;
    try {
      setStatus("Loading...");
      config          = readConfig();
      workItemService = await SDK.getService<IWorkItemFormService>(
          WorkItemTrackingServiceIds.WorkItemFormService
      );

      // Verify the JSON storage field is readable and resolve casing variants
      const resolved = await probeField(workItemService, config.dataFieldRef);
      if (resolved) {
        config.dataFieldRef = resolved;
      } else {
        // Non-fatal — extension will still render but cannot save
        setStatus(`Field not writable: ${config.dataFieldRef}`);
        warn("onLoaded: JSON storage field probe failed:", config.dataFieldRef);
      }

      // Verify the approved budget field if configured — surface misconfiguration early
      if (config.approvedBudgetFieldRef) {
        try {
          await workItemService.getFieldValue(config.approvedBudgetFieldRef!, false);
        } catch (e) {
          warn("onLoaded: Approved Budget field unreadable:", config.approvedBudgetFieldRef, e);
          setStatus(`Cannot read Approved Budget field: ${config.approvedBudgetFieldRef}`);
          // Do not null out the ref — keep it so readApprovedBudget() can retry
        }
      }

      // Attempt to mark computed output fields as read-only on the form
      // Prevents users from accidentally overwriting extension-managed values
      // setFieldOptions may not be available on all ADO versions — silently skip if absent
      const computedRefs = [
        config.totalSpentFieldRef,
        config.budgetRemainingFieldRef,
        config.percentSpentFieldRef,
      ].filter(Boolean) as string[];

      for (const ref of computedRefs) {
        try {
          await (workItemService as any).setFieldOptions(ref, { readOnly: true });
        } catch {
          // Expected on ADO Server versions that do not implement setFieldOptions
        }
      }

      // Wire toolbar buttons
      document.getElementById("addRowBtn")?.addEventListener("click", addFiscalYear);
      document.getElementById("saveBtn")?.addEventListener("click", saveToField);

      await readCurrency();
      await loadFromField();
      resizeIframe();
      setStatus("Ready");
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setStatus("Load error: " + msg);
      warn("onLoaded: unexpected error:", e);
    }
  },

  /**
   * Called when any field on the work item form changes.
   * Handles three scenarios:
   *   1. Echo suppression — ignores changes caused by our own setFieldValue calls
   *   2. External JSON storage change — another tab or user edited the field; reload
   *   3. Approved budget change — user updated Estimated Cost; refresh the banner
   *
   * The SDK may batch multiple field changes into one event. All echo fields in
   * the batch are consumed first before reacting to any real changes.
   */
  onFieldChanged: async (args: any) => {
    const changed = args?.changedFields ?? {};
    if (!Object.keys(changed).length) return;

    // Step 1 — Absorb echo fields from our own writes in this batch
    if (skipFieldChangeOnce > 0) {
      const echoFields = [
        config.dataFieldRef,
        config.totalSpentFieldRef,
        config.budgetRemainingFieldRef,
        config.percentSpentFieldRef,
      ].filter(Boolean) as string[];

      const echoCount = echoFields.filter(f => changed[f] !== undefined).length;
      if (echoCount > 0) {
        skipFieldChangeOnce = Math.max(0, skipFieldChangeOnce - echoCount);
        const hasNonEcho = Object.keys(changed).some(f => !echoFields.includes(f));
        if (!hasNonEcho) return; // Entire batch was echoes — nothing to process
      }
    }

    // Step 2 — JSON storage changed externally (not our echo) — reload the table
    if (changed[config.dataFieldRef] !== undefined && skipFieldChangeOnce === 0) {
      await loadFromField();
      return;
    }

    // Step 3 — Currency field changed externally — re-read symbol and refresh banner
    const currencyRef = config.currencyFieldRef ?? "Custom.Currency";
    if (changed[currencyRef] !== undefined) {
      await readCurrency();
      void refreshSummary();
    }

    // Step 4 — Estimated Cost changed externally — update the banner immediately
    if (config.approvedBudgetFieldRef && changed[config.approvedBudgetFieldRef] !== undefined) {
      cachedApprovedBudget = Number(changed[config.approvedBudgetFieldRef]) || 0;
      await refreshSummary();
    }
  },

  /**
   * Called after the work item is successfully saved by the user.
   * Flushes any pending debounce to ensure the last edit is not lost if
   * the user clicked the work item Save button within the 400ms debounce window.
   * Resizes the iframe after the form re-renders post-save.
   */
  onSaved: async () => {
    flushDirty();

    // Defensive flush — write any uncommitted changes that debounce may have missed
    if (workItemService) {
      try {
        const rows    = getRowsFromTable();
        const payload = JSON.stringify(rows);
        if (payload !== lastWrittenPayload) {
          skipFieldChangeOnce++;
          await workItemService.setFieldValue(config.dataFieldRef, payload);
          lastWrittenPayload = payload;
        }
      } catch (e) {
        warn("onSaved: defensive flush failed:", e);
      }
    }

    setStatus("Saved");
    // Delay resize slightly — AzDO re-renders the form after save
    setTimeout(() => { resizeIframe(); setStatus("Ready"); }, 300);
  },

  /** Called when the work item is closed or the control is unmounted. No cleanup needed. */
  onUnloaded: () => {},
});

/* ─────────────────────────────── Bootstrap ─────────────────────────────── */

SDK.init();
void SDK.ready().then(() => SDK.register(SDK.getContributionId(), provider));