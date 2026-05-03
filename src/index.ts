/**
 * Financial Budget Table — Azure DevOps Work Item Form Control
 * ─────────────────────────────────────────────────────────────
 * Purpose-built for PMO Epic "Financials" tab.
 * Each row = one cost line (Fiscal Year × Cost Category × Expense Type × Q1–Q4 amounts + Notes).
 * Computes Total Spent, Remaining, % Spent and writes back to queryable Epic decimal fields.
 */

import * as SDK from "azure-devops-extension-sdk";
import {
  IWorkItemFormService,
  WorkItemTrackingServiceIds,
} from "azure-devops-extension-api/WorkItemTracking";

import $ from "jquery";
import DataTable from "datatables.net-dt";
import "datatables.net-dt/css/dataTables.dataTables.css";
import "./styles.css";

/* ─────────────────────────────── Constants ─────────────────────────────── */

const VERSION = "1.0.0";
const DEBUG   = false;

const FISCAL_YEARS  = ["FY25", "FY26", "FY27", "FY28", "FY29", "FY30", "FY31", "FY32", "FY33", "FY34", "FY35", "FY36", "FY37", "FY38", "FY39", "FY40"];
const COST_CATS     = ["Labor", "Materials & Supplies", "Travel & Expenses", "Contracts", "Software", "Other"];
const EXPENSE_TYPES = ["CapEx", "OpEx"];

/* ─────────────────────────────── Types ─────────────────────────────── */

interface BudgetRow {
  _id:         number;
  fiscalYear:  string;
  costCat:     string;
  expenseType: string;
  q1:          number;
  q2:          number;
  q3:          number;
  q4:          number;
  notes:       string;
}

interface FinancialSummary {
  totalSpentToDate:  number;
  budgetRemaining:   number;
  percentSpent:      number;
  approvedBudget:    number;
}

interface ExtensionConfig {
  /** Multiline text field storing the JSON row array */
  dataFieldRef: string;
  /** Decimal field to read: Approved / Estimated Cost */
  approvedBudgetFieldRef: string | null;
  /** Decimal fields to write computed values back into */
  totalSpentFieldRef:    string | null;
  budgetRemainingFieldRef: string | null;
  percentSpentFieldRef:  string | null;
}

/* ─────────────────────────────── State ─────────────────────────────── */

let workItemService:    IWorkItemFormService | null = null;
let dt:                 any                  = null;
let nextId              = 1;
let suppressDirty       = false;
let skipFieldChangeOnce = 0;
let lastWrittenPayload: string | null        = null;
let config:             ExtensionConfig      = {
  dataFieldRef:           "Custom.FinancialsTableJson",
  approvedBudgetFieldRef: null,
  totalSpentFieldRef:     null,
  budgetRemainingFieldRef: null,
  percentSpentFieldRef:   null,
};

/* ─────────────────────────────── Logging ─────────────────────────────── */

function log(...a: any[]) { if (DEBUG) console.log("[FIN]", ...a); }

/* ─────────────────────────────── Config reading ─────────────────────────────── */

function readConfig(): ExtensionConfig {
  const cfg = (SDK.getConfiguration() as any)?.witInputs ?? {};
  return {
    dataFieldRef:           (cfg.DataFieldRefName ?? cfg.DataFieldRefNameText ?? "Custom.FinancialsTableJson").trim(),
    approvedBudgetFieldRef: cfg.ApprovedBudgetFieldRef?.trim() || null,
    totalSpentFieldRef:     cfg.TotalSpentFieldRef?.trim()     || null,
    budgetRemainingFieldRef: cfg.BudgetRemainingFieldRef?.trim() || null,
    percentSpentFieldRef:   cfg.PercentSpentFieldRef?.trim()   || null,
  };
}

/* ─────────────────────────────── HTML helpers ─────────────────────────────── */

function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeHtml(s: string): string {
  return s
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function stripTags(s: string): string {
  return s.replace(/<\/?[^>]+>/g, "").replace(/\u00A0/g, " ").trim();
}

function extractJsonArray(s: string): string | null {
  const start = s.indexOf("["); const end = s.lastIndexOf("]");
  return (start !== -1 && end > start) ? s.slice(start, end + 1) : null;
}

/* ─────────────────────────────── Status bar ─────────────────────────────── */

function setStatus(msg: string) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
  log("STATUS:", msg);
}

/* ─────────────────────────────── Pure finance calculator ─────────────────────────────── */

function computeFinancials(rows: BudgetRow[], approvedBudget: number): FinancialSummary {
  const totalSpentToDate = rows.reduce(
    (sum, r) => sum + (Number(r.q1) || 0) + (Number(r.q2) || 0) + (Number(r.q3) || 0) + (Number(r.q4) || 0),
    0
  );
  const budgetRemaining = approvedBudget - totalSpentToDate;
  const percentSpent    = approvedBudget > 0
    ? Math.round((totalSpentToDate / approvedBudget) * 10000) / 100
    : 0;
  return { totalSpentToDate, budgetRemaining, percentSpent, approvedBudget };
}

/* ─────────────────────────────── Financial Summary UI ─────────────────────────────── */

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtCurrency(n: number): string {
  return (n < 0 ? "-$" : "$") + fmt(Math.abs(n));
}

function renderSummary(summary: FinancialSummary) {
  const el = document.getElementById("financialSummary");
  if (!el) return;

  const pct   = summary.percentSpent;
  const ragClass = pct > 90 ? "rag-red" : pct > 75 ? "rag-amber" : "rag-green";
  const barPct   = Math.min(pct, 100);

  el.innerHTML = `
    <div class="fin-metric">
      <span class="fin-label">Approved Budget</span>
      <span class="fin-value">${fmtCurrency(summary.approvedBudget)}</span>
    </div>
    <div class="fin-metric">
      <span class="fin-label">Total Planned Spend</span>
      <span class="fin-value">${fmtCurrency(summary.totalSpentToDate)}</span>
    </div>
    <div class="fin-metric">
      <span class="fin-label">Remaining</span>
      <span class="fin-value ${summary.budgetRemaining < 0 ? 'rag-red' : ''}">${fmtCurrency(summary.budgetRemaining)}</span>
    </div>
    <div class="fin-metric ${ragClass}">
      <span class="fin-label">% of Budget</span>
      <span class="fin-value">${pct.toFixed(1)}%</span>
    </div>
    <div class="fin-progress-wrap">
      <div class="fin-progress-bar">
        <div class="fin-progress-fill ${ragClass}" style="width:${barPct}%"></div>
      </div>
      <span class="fin-progress-label ${ragClass}">${pct.toFixed(1)}% planned</span>
    </div>
  `;
  el.style.display = "flex";
}

/* ─────────────────────────────── Footer totals ─────────────────────────────── */

function updateFooterTotals(rows: BudgetRow[]) {
  const totals = { q1: 0, q2: 0, q3: 0, q4: 0 };
  rows.forEach(r => {
    totals.q1 += Number(r.q1) || 0;
    totals.q2 += Number(r.q2) || 0;
    totals.q3 += Number(r.q3) || 0;
    totals.q4 += Number(r.q4) || 0;
  });
  const grand = totals.q1 + totals.q2 + totals.q3 + totals.q4;

  const tfoot = document.querySelector("#gridTable tfoot .totals-row");
  if (!tfoot) return;
  (tfoot as HTMLElement).innerHTML = `
    <td colspan="3"><strong>TOTALS</strong></td>
    <td class="num-cell"><strong>${fmtCurrency(totals.q1)}</strong></td>
    <td class="num-cell"><strong>${fmtCurrency(totals.q2)}</strong></td>
    <td class="num-cell"><strong>${fmtCurrency(totals.q3)}</strong></td>
    <td class="num-cell"><strong>${fmtCurrency(totals.q4)}</strong></td>
    <td class="num-cell grand-total"><strong>${fmtCurrency(grand)}</strong></td>
    <td></td>
  `;
}

/* ─────────────────────────────── Row → DOM cell generators ─────────────────────────────── */

function selectCell(id: string, options: string[], value: string): string {
  const opts = options.map(o => `<option value="${esc(o)}" ${o === value ? "selected" : ""}>${esc(o)}</option>`).join("");
  return `<select class="dt-${id}" data-col="${id}">${opts}</select>`;
}

function numCell(id: string, value: number): string {
  return `<input class="dt-${id} num-input" type="number" min="0" step="1000" value="${Number(value) || 0}" data-col="${id}" />`;
}

function textCell(id: string, value: string): string {
  return `<input class="dt-${id}" type="text" value="${esc(value || "")}" data-col="${id}" />`;
}

/* ─────────────────────────────── Table rendering ─────────────────────────────── */

function renderTable(initial: BudgetRow[]) {
  suppressDirty = true;
  if ($.fn.dataTable.ext.search.length > 0) $.fn.dataTable.ext.search.length = 0;
  if (dt) { try { dt.destroy(true); } catch {} dt = null; }

  const columns = [
    {
      data: "fiscalYear", title: "Fiscal Year", width: "90px",
      render: (d: string, type: string, row: BudgetRow) =>
        type !== "display" ? d : selectCell("fiscalYear", FISCAL_YEARS, d)
    },
    {
      data: "costCat", title: "Cost Category", width: "160px",
      render: (d: string, type: string, row: BudgetRow) =>
        type !== "display" ? d : selectCell("costCat", COST_CATS, d)
    },
    {
      data: "expenseType", title: "Type", width: "80px",
      render: (d: string, type: string, row: BudgetRow) =>
        type !== "display" ? d : selectCell("expenseType", EXPENSE_TYPES, d)
    },
    {
      data: "q1", title: "Q1 ($)", width: "90px", type: "num",
      render: (d: number, type: string) => type !== "display" ? (Number(d) || 0) : numCell("q1", d)
    },
    {
      data: "q2", title: "Q2 ($)", width: "90px", type: "num",
      render: (d: number, type: string) => type !== "display" ? (Number(d) || 0) : numCell("q2", d)
    },
    {
      data: "q3", title: "Q3 ($)", width: "90px", type: "num",
      render: (d: number, type: string) => type !== "display" ? (Number(d) || 0) : numCell("q3", d)
    },
    {
      data: "q4", title: "Q4 ($)", width: "90px", type: "num",
      render: (d: number, type: string) => type !== "display" ? (Number(d) || 0) : numCell("q4", d)
    },
    {
      data: "notes", title: "Notes",
      render: (d: string, type: string) => type !== "display" ? (d || "") : textCell("notes", d)
    },
    {
      data: null, title: "Actions", width: "70px", orderable: false,
      defaultContent: `<button class="azdo-btn btn-remove" title="Delete row">Delete</button>`
    },
  ];

  dt = new DataTable("#gridTable", {
    data:       initial,
    columns,
    paging:     true,
    searching:  false,   // No global search — financial tables are short, filters not needed
    info:       true,
    ordering:   true,
    pageLength: 25,
    lengthMenu: [10, 25, 50, 100],
    order:      [[0, "asc"], [1, "asc"]],  // Sort by FY then Cost Category by default
    initComplete: function () {
      // Inject tfoot totals row
      const tfoot = document.createElement("tfoot");
      tfoot.innerHTML = `<tr class="totals-row"><td colspan="9"></td></tr>`;
      document.getElementById("gridTable")!.appendChild(tfoot);
      updateFooterTotals(initial);
    },
  });

  // Sync nextId
  try {
    const all = dt.rows({ search: "none" }).data().toArray() as BudgetRow[];
    nextId = (all.reduce((m: number, r: BudgetRow) => Math.max(m, r._id || 0), 0)) + 1;
  } catch { nextId = initial.length + 1; }

  // Wire cell change events
  $("#gridTable tbody")
    .off("input.fin change.fin click.fin")
    .on("input.fin change.fin", "input, select", () => { if (!suppressDirty) markDirty(); })
    .on("click.fin", "button.btn-remove", function () {
      dt.row($(this).closest("tr")).remove().draw(false);
      if (!suppressDirty) {
        markDirty();
        refreshSummary();
      }
    });

  // Wire draw event to keep footer totals in sync
  dt.on("draw.dt", () => {
    const rows = getRowsFromTable();
    updateFooterTotals(rows);
  });

  SDK.resize();
  setTimeout(() => { suppressDirty = false; }, 500);
}

/* ─────────────────────────────── Row reader (DOM → data) ─────────────────────────────── */

function getRowsFromTable(): BudgetRow[] {
  const rows: BudgetRow[] = [];
  if (!dt) return rows;

  const idxs = dt.rows({ search: "none" }).indexes().toArray() as number[];
  for (const idx of idxs) {
    const data  = dt.row(idx).data() as BudgetRow || {};
    const node  = dt.row(idx).node?.() as HTMLElement | null;
    const row: BudgetRow = {
      _id:         data._id || idx + 1,
      fiscalYear:  data.fiscalYear  || FISCAL_YEARS[0],
      costCat:     data.costCat     || COST_CATS[0],
      expenseType: data.expenseType || EXPENSE_TYPES[0],
      q1:          data.q1 ?? 0,
      q2:          data.q2 ?? 0,
      q3:          data.q3 ?? 0,
      q4:          data.q4 ?? 0,
      notes:       data.notes || "",
    };

    if (node) {
      const $tr = $(node);
      (["fiscalYear", "costCat", "expenseType"] as const).forEach(col => {
        const sel = $tr.find(`select.dt-${col}`);
        if (sel.length) (row as any)[col] = sel.val() as string;
      });
      (["q1", "q2", "q3", "q4"] as const).forEach(col => {
        const inp = $tr.find(`input.dt-${col}`);
        if (inp.length) row[col] = Number(inp.val()) || 0;
      });
      const notes = $tr.find("input.dt-notes");
      if (notes.length) row.notes = notes.val() as string || "";
    }

    rows.push(row);
  }

  nextId = (rows.reduce((m, r) => Math.max(m, r._id || 0), 0)) + 1;
  return rows;
}

/* ─────────────────────────────── Field writeback ─────────────────────────────── */

async function readApprovedBudget(): Promise<number> {
  if (!workItemService || !config.approvedBudgetFieldRef) return 0;
  try {
    const val = await workItemService.getFieldValue(config.approvedBudgetFieldRef);
    return Number(val) || 0;
  } catch (e) {
    log("readApprovedBudget error", e);
    return 0;
  }
}

async function writeComputedFields(summary: FinancialSummary): Promise<void> {
  if (!workItemService) return;

  const writes: Array<[string | null, number]> = [
    [config.totalSpentFieldRef,     summary.totalSpentToDate],
    [config.budgetRemainingFieldRef, summary.budgetRemaining],
    [config.percentSpentFieldRef,   summary.percentSpent],
  ];

  const activeWrites = writes.filter(([f]) => !!f);
  if (activeWrites.length === 0) return;

  skipFieldChangeOnce += activeWrites.length;

  for (const [field, value] of activeWrites) {
    try {
      await workItemService.setFieldValue(field!, value);
    } catch (e) {
      log(`writeComputedFields failed for ${field}:`, e);
    }
  }
}

/* ─────────────────────────────── Recalculate + refresh ─────────────────────────────── */

async function refreshSummary(): Promise<void> {
  const rows    = getRowsFromTable();
  const approved = await readApprovedBudget();
  const summary  = computeFinancials(rows, approved);
  renderSummary(summary);
  updateFooterTotals(rows);
}

/* ─────────────────────────────── Persistence ─────────────────────────────── */

let dirtyDebounce: number | undefined;

function markDirty() {
  if (suppressDirty || !workItemService) return;
  window.clearTimeout(dirtyDebounce);
  dirtyDebounce = window.setTimeout(async () => {
    try {
      const payload = JSON.stringify(getRowsFromTable());
      if (payload === lastWrittenPayload) { setStatus("Pending changes…"); return; }

      skipFieldChangeOnce++;
      const ok = await workItemService!.setFieldValue(config.dataFieldRef, payload);
      lastWrittenPayload = payload;
      setStatus(ok ? "Pending changes…" : "⚠️ Could not auto-save");

      // Recalculate and write computed fields
      const rows     = getRowsFromTable();
      const approved = await readApprovedBudget();
      const summary  = computeFinancials(rows, approved);
      renderSummary(summary);
      updateFooterTotals(rows);
      await writeComputedFields(summary);

    } catch (e: any) {
      setStatus("Auto-save error: " + (e?.message ?? String(e)));
    }
  }, 300);
}

async function saveToField() {
  if (!workItemService) return;
  try {
    const payload = JSON.stringify(getRowsFromTable());
    skipFieldChangeOnce++;
    const ok = await workItemService.setFieldValue(config.dataFieldRef, payload);
    lastWrittenPayload = payload;
    if (!ok) throw new Error("setFieldValue returned false");

    const approved = await readApprovedBudget();
    const summary  = computeFinancials(getRowsFromTable(), approved);
    await writeComputedFields(summary);

    setStatus("Saved ✓");
    setTimeout(() => setStatus("Ready"), 3000);
  } catch (err: any) {
    setStatus("Save error: " + (err?.message ?? String(err)));
  }
}

/* ─────────────────────────────── Load ─────────────────────────────── */

async function loadFromField(): Promise<void> {
  if (!workItemService) return;
  suppressDirty = true;

  let rows: BudgetRow[] = [];
  try {
    let raw = await workItemService.getFieldValue(config.dataFieldRef);
    if (typeof raw !== "string") raw = raw == null ? "" : String(raw);

    let text    = decodeHtml(String(raw));
    text        = stripTags(text);
    const json  = extractJsonArray(text) ?? "";

    if (json) {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        rows = parsed.map((p: any, i: number): BudgetRow => ({
          _id:         p._id         || i + 1,
          fiscalYear:  p.fiscalYear  || FISCAL_YEARS[0],
          costCat:     p.costCat     || COST_CATS[0],
          expenseType: p.expenseType || EXPENSE_TYPES[0],
          q1:          Number(p.q1)  || 0,
          q2:          Number(p.q2)  || 0,
          q3:          Number(p.q3)  || 0,
          q4:          Number(p.q4)  || 0,
          notes:       p.notes       || "",
        }));
      }
    }
  } catch (e) { log("loadFromField error", e); }

  renderTable(rows);

  // Show initial summary (read-only on load — no writeback)
  const approved = await readApprovedBudget();
  const summary  = computeFinancials(rows, approved);
  renderSummary(summary);
  updateFooterTotals(rows);

  setTimeout(() => { suppressDirty = false; }, 350);
}

/* ─────────────────────────────── Add Row ─────────────────────────────── */

function addNewRow() {
  if (!dt) return;
  const newRow: BudgetRow = {
    _id:         nextId++,
    fiscalYear:  FISCAL_YEARS[0],
    costCat:     COST_CATS[0],
    expenseType: EXPENSE_TYPES[0],
    q1:          0,
    q2:          0,
    q3:          0,
    q4:          0,
    notes:       "",
  };
  dt.row.add(newRow).draw(false);
  if (!suppressDirty) markDirty();
}

/* ─────────────────────────────── Field probe ─────────────────────────────── */

async function probeField(svc: IWorkItemFormService, ref: string): Promise<string | null> {
  const variants = [ref, ref.replace(/Json$/, "JSON"), ref.replace(/JSON$/, "Json")];
  for (const f of variants) {
    try {
      const cur = await svc.getFieldValue(f);
      const ok  = await svc.setFieldValue(f, cur);
      if (ok) return f;
    } catch {}
  }
  return null;
}

/* ─────────────────────────────── SDK provider ─────────────────────────────── */

const provider = () => ({
  onLoaded: async () => {
    try {
      setStatus("Loading…");
      config = readConfig();

      workItemService = await SDK.getService<IWorkItemFormService>(
        WorkItemTrackingServiceIds.WorkItemFormService
      );

      // Probe and resolve the JSON storage field
      const resolved = await probeField(workItemService, config.dataFieldRef);
      if (resolved) {
        config.dataFieldRef = resolved;
      } else {
        setStatus(`⚠️ Field not writable: ${config.dataFieldRef}`);
      }

      // Wire buttons
      document.getElementById("addRowBtn")!.addEventListener("click", addNewRow);
      document.getElementById("saveBtn")!.addEventListener("click", saveToField);

      await loadFromField();
      setStatus("Ready");

    } catch (e: any) {
      setStatus("Load error: " + (e?.message ?? String(e)));
    }
  },

  onFieldChanged: async (args: any) => {
    const changed = args?.changedFields ?? {};

    // Ignore echo from our own write to the JSON field
    if (changed[config.dataFieldRef] !== undefined) {
      if (skipFieldChangeOnce > 0) { skipFieldChangeOnce--; return; }
      await loadFromField();
      return;
    }

    // Skip echo from computed field writes
    if (skipFieldChangeOnce > 0) {
      const computedFields = [
        config.totalSpentFieldRef,
        config.budgetRemainingFieldRef,
        config.percentSpentFieldRef,
      ].filter(Boolean);
      const writtenFieldChanged = computedFields.some(f => f && changed[f] !== undefined);
      if (writtenFieldChanged) { skipFieldChangeOnce--; return; }
    }

    // If Approved Budget changed externally (e.g., someone edits the field on another tab) → recalculate
    if (config.approvedBudgetFieldRef && changed[config.approvedBudgetFieldRef] !== undefined) {
      await refreshSummary();
    }
  },

  onSaved: async () => {
    setStatus("Saved ✓");
    setTimeout(() => setStatus("Ready"), 3000);
  },

  onUnloaded: () => {},
});

SDK.init();
SDK.ready().then(() => SDK.register(SDK.getContributionId(), provider));
