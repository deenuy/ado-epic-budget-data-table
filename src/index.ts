/**
 * ADO Epic Budget Table — Azure DevOps Work Item Form Control
 * ─────────────────────────────────────────────────────────────
 * Transposed layout: rows = Q1/Q2/Q3/Q4, columns = Fiscal Years.
 * Each fiscal year is a column. Adding a year adds a column.
 * FY totals shown in footer row per column.
 * Storage format unchanged — BudgetRow per fiscal year.
 */

import * as SDK from "azure-devops-extension-sdk";
import {
  IWorkItemFormService,
  WorkItemTrackingServiceIds,
} from "azure-devops-extension-api/WorkItemTracking";

import "./styles.css";

/* ─────────────────────────────── Constants ─────────────────────────────── */

const DEBUG = false;

const ALL_FISCAL_YEARS = [
  "FY25","FY26","FY27","FY28","FY29","FY30",
  "FY31","FY32","FY33","FY34","FY35","FY36",
  "FY37","FY38","FY39","FY40",
];

const QUARTERS: Array<keyof Pick<BudgetRow,"q1"|"q2"|"q3"|"q4">> = ["q1","q2","q3","q4"];
const QUARTER_LABELS = ["Q1 ($)","Q2 ($)","Q3 ($)","Q4 ($)"];

/* ─────────────────────────────── Types ─────────────────────────────── */

interface BudgetRow {
  _id:        number;
  fiscalYear: string;
  q1:         number;
  q2:         number;
  q3:         number;
  q4:         number;
  notes:      string;
}

interface FinancialSummary {
  totalPlannedSpend: number;
  budgetRemaining:   number;
  percentSpent:      number;
  approvedBudget:    number;
}

interface ExtensionConfig {
  dataFieldRef:            string;
  approvedBudgetFieldRef:  string | null;
  totalSpentFieldRef:      string | null;
  budgetRemainingFieldRef: string | null;
  percentSpentFieldRef:    string | null;
}

/* ─────────────────────────────── State ─────────────────────────────── */

let workItemService:      IWorkItemFormService | null = null;
let nextId                = 1;
let suppressDirty         = false;
let skipFieldChangeOnce   = 0;
let lastWrittenPayload:   string | null        = null;
let cachedApprovedBudget: number               = 0;
let currentRows:          BudgetRow[]          = [];
let config: ExtensionConfig = {
  dataFieldRef:            "Custom.FinancialsTableJson",
  approvedBudgetFieldRef:  null,
  totalSpentFieldRef:      null,
  budgetRemainingFieldRef: null,
  percentSpentFieldRef:    null,
};

/* ─────────────────────────────── Logging ─────────────────────────────── */

function log(...a: any[])  { if (DEBUG) console.log("[FIN]", ...a); }
function warn(...a: any[]) { console.warn("[FIN]", ...a); }

/* ─────────────────────────────── Config ─────────────────────────────── */

function readConfig(): ExtensionConfig {
  const cfg = (SDK.getConfiguration() as any)?.witInputs ?? {};
  return {
    dataFieldRef:            (cfg.DataFieldRefName ?? "Custom.FinancialsTableJson").trim(),
    approvedBudgetFieldRef:  cfg.ApprovedBudgetFieldRef?.trim() || null,
    totalSpentFieldRef:      cfg.TotalSpentFieldRef?.trim()     || null,
    budgetRemainingFieldRef: cfg.BudgetRemainingFieldRef?.trim() || null,
    percentSpentFieldRef:    cfg.PercentSpentFieldRef?.trim()   || null,
  };
}

/* ─────────────────────────────── HTML helpers ─────────────────────────────── */

function esc(s: string): string {
  return String(s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function decodeHtml(s: string): string {
  return s
      .replace(/&quot;/g,'"').replace(/&#39;/g,"'")
      .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");
}

function stripTags(s: string): string {
  return s.replace(/<\/?[^>]+>/g,"").replace(/\u00A0/g," ").trim();
}

function extractJsonArray(s: string): string | null {
  const start = s.indexOf("["); const end = s.lastIndexOf("]");
  return (start !== -1 && end > start) ? s.slice(start, end + 1) : null;
}

/* ─────────────────────────────── Status ─────────────────────────────── */

function setStatus(msg: string) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
  log("STATUS:", msg);
}

/* ─────────────────────────────── Finance ─────────────────────────────── */

function computeFinancials(rows: BudgetRow[], approvedBudget: number): FinancialSummary {
  const totalPlannedSpend = rows.reduce(
      (sum,r) => sum+(Number(r.q1)||0)+(Number(r.q2)||0)+(Number(r.q3)||0)+(Number(r.q4)||0), 0
  );
  const budgetRemaining = approvedBudget - totalPlannedSpend;
  const percentSpent    = approvedBudget > 0
      ? Math.round((totalPlannedSpend / approvedBudget) * 10000) / 100 : 0;
  return { totalPlannedSpend, budgetRemaining, percentSpent, approvedBudget };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US",{ minimumFractionDigits:0, maximumFractionDigits:0 });
}

function fmtCurrency(n: number): string {
  return (n < 0 ? "-$" : "$") + fmt(Math.abs(n));
}

/* ─────────────────────────────── Summary banner ─────────────────────────────── */

function renderSummary(summary: FinancialSummary) {
  const el = document.getElementById("financialSummary");
  if (!el) return;
  const hasApproved = summary.approvedBudget > 0;
  const pct      = summary.percentSpent;
  const ragClass = !hasApproved ? "rag-green" : pct > 90 ? "rag-red" : pct > 75 ? "rag-amber" : "rag-green";
  const barPct   = hasApproved ? Math.min(pct, 100) : 0;
  el.innerHTML = `
    <div class="fin-metric">
      <span class="fin-label">Estimated Cost</span>
      <span class="fin-value">${hasApproved ? fmtCurrency(summary.approvedBudget) : "Not set"}</span>
    </div>
    <div class="fin-metric">
      <span class="fin-label">Total Planned Spend</span>
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
      <span class="fin-value">${hasApproved ? pct.toFixed(1)+"%" : "—"}</span>
    </div>
    <div class="fin-progress-wrap">
      <div class="fin-progress-bar">
        <div class="fin-progress-fill ${ragClass}" style="width:${barPct}%"></div>
      </div>
      <span class="fin-progress-label ${ragClass}">
        ${hasApproved ? pct.toFixed(1)+"% planned" : "Configure Estimated Cost field in control Options to see % of budget"}
      </span>
    </div>
  `;
  el.style.display = "flex";
}

/* ─────────────────────────────── Fiscal year helpers ─────────────────────────────── */

function availableFiscalYears(rows: BudgetRow[]): string[] {
  const used = new Set(rows.map(r => r.fiscalYear));
  return ALL_FISCAL_YEARS.filter(fy => !used.has(fy));
}

function nextFiscalYear(rows: BudgetRow[]): string {
  const available = availableFiscalYears(rows);
  if (available.length === 0) return ALL_FISCAL_YEARS[ALL_FISCAL_YEARS.length - 1];
  if (rows.length === 0) return available[0];
  const maxUsedIdx = Math.max(...rows.map(r => ALL_FISCAL_YEARS.indexOf(r.fiscalYear)));
  const nextInSequence = ALL_FISCAL_YEARS.slice(maxUsedIdx + 1).find(fy => available.includes(fy));
  return nextInSequence ?? available[0];
}

/* ─────────────────────────────── Transposed table rendering ─────────────────────────────── */

function renderTable(rows: BudgetRow[]) {
  suppressDirty = true;

  // Sort by fiscal year ascending
  const sorted = [...rows].sort((a,b) =>
      ALL_FISCAL_YEARS.indexOf(a.fiscalYear) - ALL_FISCAL_YEARS.indexOf(b.fiscalYear)
  );
  currentRows = sorted;

  const wrap = document.getElementById("tableWrap");
  if (!wrap) return;

  if (sorted.length === 0) {
    wrap.innerHTML = `<p class="no-rows-msg">No fiscal years added yet. Click Add FY to start.</p>`;
    setTimeout(() => { suppressDirty = false; }, 500);
    return;
  }

  // Build transposed HTML table
  // Columns: row-label | FY1 | FY2 | FY3 ... | (delete row at top)
  let html = `<table class="azdo-table transposed-table" id="gridTable">`;

  // ── Header row: FY labels ──
  html += `<thead><tr><th class="row-label-cell"></th>`;
  for (const row of sorted) {
    html += `<th class="fy-header">${esc(row.fiscalYear)}</th>`;
  }
  html += `</tr>`;

  // ── Delete row: one Delete button per FY column ──
  html += `<tr class="delete-row"><td class="row-label-cell"></td>`;
  for (const row of sorted) {
    html += `<td><button class="azdo-btn btn-remove" data-fy="${esc(row.fiscalYear)}" type="button">Delete</button></td>`;
  }
  html += `</tr></thead>`;

  // ── Body: 4 fixed rows — one per quarter ──
  html += `<tbody>`;
  for (let qi = 0; qi < QUARTERS.length; qi++) {
    const q   = QUARTERS[qi];
    const lbl = QUARTER_LABELS[qi];
    html += `<tr><td class="row-label-cell"><strong>${esc(lbl)}</strong></td>`;
    for (const row of sorted) {
      const val = Number(row[q]) || 0;
      html += `<td><input class="num-input" type="number" min="0" step="1000"
        data-fy="${esc(row.fiscalYear)}" data-q="${q}"
        value="${val}" /></td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody>`;

  // ── Footer: FY totals ──
  html += `<tfoot><tr class="totals-row"><td class="row-label-cell"><strong>FY TOTAL</strong></td>`;
  for (const row of sorted) {
    const total = (Number(row.q1)||0)+(Number(row.q2)||0)+(Number(row.q3)||0)+(Number(row.q4)||0);
    html += `<td class="num-cell fy-total" data-fy="${esc(row.fiscalYear)}"><strong>${fmtCurrency(total)}</strong></td>`;
  }
  html += `</tr></tfoot>`;

  html += `</table>`;
  wrap.innerHTML = html;

  // Wire input events
  wrap.querySelectorAll("input.num-input").forEach(inp => {
    inp.addEventListener("input", () => {
      if (!suppressDirty) {
        updateFYTotal(inp.getAttribute("data-fy")!);
        markDirty();
      }
    });
    inp.addEventListener("change", () => {
      if (!suppressDirty) refreshSummary();
    });
  });

  // Wire delete buttons
  wrap.querySelectorAll("button.btn-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      const fy = btn.getAttribute("data-fy")!;
      removeFiscalYear(fy);
    });
  });

  resizeIframe();
  setTimeout(() => { suppressDirty = false; }, 500);
}

/** Update the FY total footer cell for one column after an input change */
function updateFYTotal(fy: string) {
  const inputs = document.querySelectorAll<HTMLInputElement>(
      `input.num-input[data-fy="${fy}"]`
  );
  let total = 0;
  inputs.forEach(inp => { total += Number(inp.value) || 0; });
  const cell = document.querySelector<HTMLElement>(`.fy-total[data-fy="${fy}"]`);
  if (cell) cell.innerHTML = `<strong>${fmtCurrency(total)}</strong>`;
}

/* ─────────────────────────────── DOM → data reader ─────────────────────────────── */

function getRowsFromTable(): BudgetRow[] {
  // Read current values from DOM inputs — columns = FY, rows = quarters
  const rows: BudgetRow[] = [];
  if (!currentRows.length) return rows;

  for (const template of currentRows) {
    const fy  = template.fiscalYear;
    const row: BudgetRow = { _id: template._id, fiscalYear: fy, q1:0, q2:0, q3:0, q4:0, notes:"" };
    for (const q of QUARTERS) {
      const inp = document.querySelector<HTMLInputElement>(
          `input.num-input[data-fy="${fy}"][data-q="${q}"]`
      );
      if (inp) row[q] = Number(inp.value) || 0;
    }
    rows.push(row);
  }

  // Always return sorted ascending
  rows.sort((a,b) => ALL_FISCAL_YEARS.indexOf(a.fiscalYear) - ALL_FISCAL_YEARS.indexOf(b.fiscalYear));
  return rows;
}

/* ─────────────────────────────── Add / Remove FY ─────────────────────────────── */

function addFiscalYear() {
  const rows      = getRowsFromTable();
  const available = availableFiscalYears(rows);
  if (available.length === 0) {
    setStatus("All fiscal years have been added.");
    setTimeout(() => setStatus("Ready"), 3000);
    return;
  }
  const nextFY = nextFiscalYear(rows);
  const newRow: BudgetRow = { _id: nextId++, fiscalYear: nextFY, q1:0, q2:0, q3:0, q4:0, notes:"" };
  currentRows = [...rows, newRow].sort((a,b) =>
      ALL_FISCAL_YEARS.indexOf(a.fiscalYear) - ALL_FISCAL_YEARS.indexOf(b.fiscalYear)
  );
  renderTable(currentRows);
  if (!suppressDirty) { refreshSummary(); markDirty(); }
}

function removeFiscalYear(fy: string) {
  const rows = getRowsFromTable().filter(r => r.fiscalYear !== fy);
  currentRows = rows;
  renderTable(rows);
  if (!suppressDirty) { refreshSummary(); markDirty(); resizeIframe(); }
}

/* ─────────────────────────────── Summary refresh ─────────────────────────────── */

async function refreshSummary(): Promise<void> {
  const rows     = getRowsFromTable();
  const approved = await readApprovedBudget();
  const summary  = computeFinancials(rows, approved);
  renderSummary(summary);
}

/* ─────────────────────────────── Approved budget ─────────────────────────────── */

async function readApprovedBudget(): Promise<number> {
  if (!workItemService) return cachedApprovedBudget;
  // Use configured ref if set, otherwise fall back to Custom.EstimatedCost
  const candidates = Array.from(new Set([
    config.approvedBudgetFieldRef ?? "Custom.EstimatedCost",
  ]));
  for (const candidate of candidates) {
    try {
      const val = await workItemService.getFieldValue(candidate);
      if (val === null || val === undefined || val === "") {
        log("readApprovedBudget: empty for", candidate);
        continue;
      }
      const n = Number(val);
      if (!isNaN(n)) {
        log("readApprovedBudget: resolved", candidate, "=", n);
        cachedApprovedBudget = n;
        config.approvedBudgetFieldRef = candidate;
        return n;
      }
    } catch(e) { warn("readApprovedBudget failed for:", candidate, e); }
  }
  warn("readApprovedBudget: no candidate returned a value. Tried:", candidates.join(", "));
  return cachedApprovedBudget;
}

/* ─────────────────────────────── Computed field writeback ─────────────────────────────── */

async function writeComputedFields(summary: FinancialSummary): Promise<void> {
  if (!workItemService) return;
  const writes: Array<[string|null, number]> = [
    [config.totalSpentFieldRef,      summary.totalPlannedSpend],
    [config.budgetRemainingFieldRef, summary.budgetRemaining],
    [config.percentSpentFieldRef,    summary.percentSpent],
  ];
  const active = writes.filter(([f]) => !!f) as [string,number][];
  if (!active.length) return;
  skipFieldChangeOnce += active.length;
  for (const [field, value] of active) {
    try { await workItemService.setFieldValue(field, value); }
    catch(e) { warn(`writeComputedFields failed for ${field}:`, e); }
  }
}

/* ─────────────────────────────── Persistence ─────────────────────────────── */

let dirtyDebounce: number | undefined;

function flushDirty(): void {
  window.clearTimeout(dirtyDebounce);
}

function markDirty() {
  if (suppressDirty || !workItemService) return;
  window.clearTimeout(dirtyDebounce);
  dirtyDebounce = window.setTimeout(async () => {
    try {
      const rows    = getRowsFromTable();
      const payload = JSON.stringify(rows);
      if (payload === lastWrittenPayload) return;
      skipFieldChangeOnce++;
      const ok = await workItemService!.setFieldValue(config.dataFieldRef, payload);
      lastWrittenPayload = payload;
      setStatus(ok ? "Pending changes..." : "Could not auto-save");
      const approved = await readApprovedBudget();
      const summary  = computeFinancials(rows, approved);
      renderSummary(summary);
      await writeComputedFields(summary);
    } catch(e: any) { setStatus("Auto-save error: " + (e?.message ?? String(e))); }
  }, 400);
}

async function saveToField() {
  if (!workItemService) return;
  flushDirty();
  try {
    const rows    = getRowsFromTable();
    const payload = JSON.stringify(rows);
    skipFieldChangeOnce++;
    const ok = await workItemService.setFieldValue(config.dataFieldRef, payload);
    lastWrittenPayload = payload;
    if (!ok) throw new Error("setFieldValue returned false");
    const approved = await readApprovedBudget();
    const summary  = computeFinancials(rows, approved);
    renderSummary(summary);
    await writeComputedFields(summary);
    setStatus("Saved");
    setTimeout(() => setStatus("Ready"), 3000);
  } catch(err: any) { setStatus("Save error: " + (err?.message ?? String(err))); }
}

/* ─────────────────────────────── Load ─────────────────────────────── */

async function loadFromField(): Promise<void> {
  if (!workItemService) return;
  suppressDirty = true;
  let rows: BudgetRow[] = [];
  try {
    let raw = await workItemService.getFieldValue(config.dataFieldRef);
    if (typeof raw !== "string") raw = raw == null ? "" : String(raw);
    const text = stripTags(decodeHtml(String(raw)));
    const json = extractJsonArray(text) ?? "";
    if (json) {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) {
        rows = parsed.map((p:any, i:number): BudgetRow => ({
          _id: p._id || i+1, fiscalYear: p.fiscalYear || ALL_FISCAL_YEARS[0],
          q1: Number(p.q1)||0, q2: Number(p.q2)||0, q3: Number(p.q3)||0, q4: Number(p.q4)||0,
          notes: p.notes || "",
        }));
      }
    }
  } catch(e) { log("loadFromField error", e); }

  rows.sort((a,b) => ALL_FISCAL_YEARS.indexOf(a.fiscalYear) - ALL_FISCAL_YEARS.indexOf(b.fiscalYear));
  renderTable(rows);
  const approved = await readApprovedBudget();
  const summary  = computeFinancials(rows, approved);
  renderSummary(summary);
}

/* ─────────────────────────────── Resize ─────────────────────────────── */

function resizeIframe() {
  const h = document.getElementById("app")?.scrollHeight ?? 400;
  SDK.resize(undefined, h);
}

/* ─────────────────────────────── Field probe ─────────────────────────────── */

async function probeField(svc: IWorkItemFormService, ref: string): Promise<string | null> {
  const variants = [ref, ref.replace(/Json$/,"JSON"), ref.replace(/JSON$/,"Json")];
  for (const f of variants) {
    try { await svc.getFieldValue(f); return f; } catch {}
  }
  return null;
}

/* ─────────────────────────────── SDK provider ─────────────────────────────── */

const provider = () => ({
  onLoaded: async () => {
    try {
      setStatus("Loading...");
      config          = readConfig();
      workItemService = await SDK.getService<IWorkItemFormService>(WorkItemTrackingServiceIds.WorkItemFormService);

      // Diagnostic: log all numeric fields to help identify ref names
      try {
        const allFields = await workItemService.getFields();
        const numericFields = (allFields as any[])
            .filter(f => f.type === 2 || f.type === 1)
            .map(f => `${f.referenceName} ("${f.name}")`);
        warn("Numeric fields on this WIT:", numericFields.join(" | "));
      } catch(e) { log("getFields diagnostic failed:", e); }

      const resolved = await probeField(workItemService, config.dataFieldRef);
      if (resolved) { config.dataFieldRef = resolved; }
      else { setStatus(`Field not writable: ${config.dataFieldRef}`); }

      if (config.approvedBudgetFieldRef) {
        try { await workItemService.getFieldValue(config.approvedBudgetFieldRef); }
        catch(e) {
          warn("Approved Budget field unreadable:", config.approvedBudgetFieldRef, e);
          setStatus(`Cannot read Approved Budget field: ${config.approvedBudgetFieldRef}`);
        }
      }

      document.getElementById("addRowBtn")!.addEventListener("click", addFiscalYear);
      document.getElementById("saveBtn")!.addEventListener("click", saveToField);
      await loadFromField();
      resizeIframe();
      setStatus("Ready");
    } catch(e:any) { setStatus("Load error: " + (e?.message ?? String(e))); }
  },

  onFieldChanged: async (args: any) => {
    const changed = args?.changedFields ?? {};
    if (!Object.keys(changed).length) return;

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
        if (!hasNonEcho) return;
      }
    }

    if (changed[config.dataFieldRef] !== undefined && skipFieldChangeOnce === 0) {
      await loadFromField();
      return;
    }

    if (config.approvedBudgetFieldRef && changed[config.approvedBudgetFieldRef] !== undefined) {
      cachedApprovedBudget = Number(changed[config.approvedBudgetFieldRef]) || 0;
      await refreshSummary();
    }
  },

  onSaved: async () => {
    flushDirty();
    if (workItemService) {
      const rows    = getRowsFromTable();
      const payload = JSON.stringify(rows);
      if (payload !== lastWrittenPayload) {
        skipFieldChangeOnce++;
        await workItemService.setFieldValue(config.dataFieldRef, payload);
        lastWrittenPayload = payload;
      }
    }
    setStatus("Saved");
    setTimeout(() => { resizeIframe(); setStatus("Ready"); }, 300);
  },
  onUnloaded: () => {},
});

SDK.init();
SDK.ready().then(() => SDK.register(SDK.getContributionId(), provider));