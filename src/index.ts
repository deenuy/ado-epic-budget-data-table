/**
 * ADO Epic Budget Table — Azure DevOps Work Item Form Control
 * ─────────────────────────────────────────────────────────────
 * Each row = one Fiscal Year x Q1-Q4 amounts + Notes.
 * Rules:
 *   - One row per fiscal year, no duplicates allowed
 *   - Rows ordered by fiscal year ascending, locked
 *   - Add Row defaults to next available fiscal year
 *   - Approved Budget read from configured Epic decimal field
 *   - Remaining = Approved - sum(all Q1-Q4 across all rows)
 *   - % of Budget only shown when Approved Budget > 0
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

const DEBUG = false;

const ALL_FISCAL_YEARS = [
  "FY25","FY26","FY27","FY28","FY29","FY30",
  "FY31","FY32","FY33","FY34","FY35","FY36",
  "FY37","FY38","FY39","FY40",
];

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

let workItemService:      IWorkItemFormService | null = null;
let dt:                   any                  = null;
let nextId                = 1;
let suppressDirty         = false;
let skipFieldChangeOnce   = 0;
let lastWrittenPayload:   string | null        = null;
let cachedApprovedBudget: number               = 0;
let config: ExtensionConfig = {
  dataFieldRef:            "Custom.FinancialsTableJson",
  approvedBudgetFieldRef:  null,
  totalSpentFieldRef:      null,
  budgetRemainingFieldRef: null,
  percentSpentFieldRef:    null,
};

function log(...a: any[])  { if (DEBUG) console.log("[FIN]", ...a); }
function warn(...a: any[]) { console.warn("[FIN]", ...a); } // Always logs — used for errors that must be visible in prod

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

function esc(s: string): string {
  return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

function setStatus(msg: string) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
  log("STATUS:", msg);
}

function computeFinancials(rows: BudgetRow[], approvedBudget: number): FinancialSummary {
  const totalPlannedSpend = rows.reduce(
      (sum, r) => sum + (Number(r.q1)||0) + (Number(r.q2)||0) + (Number(r.q3)||0) + (Number(r.q4)||0), 0
  );
  const budgetRemaining = approvedBudget - totalPlannedSpend;
  const percentSpent    = approvedBudget > 0
      ? Math.round((totalPlannedSpend / approvedBudget) * 10000) / 100
      : 0;
  return { totalPlannedSpend, budgetRemaining, percentSpent, approvedBudget };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtCurrency(n: number): string {
  return (n < 0 ? "-$" : "$") + fmt(Math.abs(n));
}

function renderSummary(summary: FinancialSummary) {
  const el = document.getElementById("financialSummary");
  if (!el) return;

  const hasApproved = summary.approvedBudget > 0;
  const pct         = summary.percentSpent;
  const ragClass    = !hasApproved ? "rag-green" : pct > 90 ? "rag-red" : pct > 75 ? "rag-amber" : "rag-green";
  const barPct      = hasApproved ? Math.min(pct, 100) : 0;

  el.innerHTML = `
    <div class="fin-metric">
      <span class="fin-label">Approved Budget</span>
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
      <span class="fin-value">${hasApproved ? pct.toFixed(1) + "%" : "—"}</span>
    </div>
    <div class="fin-progress-wrap">
      <div class="fin-progress-bar">
        <div class="fin-progress-fill ${ragClass}" style="width:${barPct}%"></div>
      </div>
      <span class="fin-progress-label ${ragClass}">
        ${hasApproved ? pct.toFixed(1) + "% planned" : "Configure an Approved Budget field in control Options to see % of budget"}
      </span>
    </div>
  `;
  el.style.display = "flex";
}

function updateFooterTotals(rows: BudgetRow[]) {
  const t = { q1:0, q2:0, q3:0, q4:0 };
  rows.forEach(r => { t.q1+=Number(r.q1)||0; t.q2+=Number(r.q2)||0; t.q3+=Number(r.q3)||0; t.q4+=Number(r.q4)||0; });
  const tfoot = document.querySelector("#gridTable tfoot .totals-row");
  if (!tfoot) return;
  // Grand total is in the summary banner — footer shows per-quarter totals only
  (tfoot as HTMLElement).innerHTML = `
    <td><strong>TOTALS</strong></td>
    <td class="num-cell"><strong>${fmtCurrency(t.q1)}</strong></td>
    <td class="num-cell"><strong>${fmtCurrency(t.q2)}</strong></td>
    <td class="num-cell"><strong>${fmtCurrency(t.q3)}</strong></td>
    <td class="num-cell"><strong>${fmtCurrency(t.q4)}</strong></td>
    <td></td>
    <td></td>
  `;
}

function availableFiscalYears(rows: BudgetRow[]): string[] {
  const used = new Set(rows.map(r => r.fiscalYear));
  return ALL_FISCAL_YEARS.filter(fy => !used.has(fy));
}

function nextFiscalYear(rows: BudgetRow[]): string {
  const available = availableFiscalYears(rows);
  if (available.length === 0) return ALL_FISCAL_YEARS[ALL_FISCAL_YEARS.length - 1];
  if (rows.length === 0) return available[0];
  // Find the highest used FY index and return the next sequential available year
  const maxUsedIdx = Math.max(...rows.map(r => ALL_FISCAL_YEARS.indexOf(r.fiscalYear)));
  const nextInSequence = ALL_FISCAL_YEARS.slice(maxUsedIdx + 1).find(fy => available.includes(fy));
  return nextInSequence ?? available[0];
}

function buildFYSelect(currentFY: string, usedFYs: Set<string>): string {
  const opts = ALL_FISCAL_YEARS
      .filter(fy => !usedFYs.has(fy) || fy === currentFY)
      .map(fy => `<option value="${esc(fy)}" ${fy === currentFY ? "selected" : ""}>${esc(fy)}</option>`)
      .join("");
  return `<select class="dt-fiscalYear" data-col="fiscalYear">${opts}</select>`;
}

function numCell(id: string, value: number): string {
  return `<input class="dt-${id} num-input" type="number" min="0" step="1000" value="${Number(value)||0}" data-col="${id}" />`;
}

function textCell(id: string, value: string): string {
  return `<input class="dt-${id}" type="text" value="${esc(value||"")}" data-col="${id}" />`;
}

function getRowsFromTable(): BudgetRow[] {
  const rows: BudgetRow[] = [];
  if (!dt) return rows;
  const idxs = dt.rows().indexes().toArray() as number[];
  for (const idx of idxs) {
    const data = dt.row(idx).data() as BudgetRow || {};
    const node = dt.row(idx).node?.() as HTMLElement | null;
    const row: BudgetRow = {
      _id:        data._id || idx + 1,
      fiscalYear: data.fiscalYear || ALL_FISCAL_YEARS[0],
      q1: data.q1 ?? 0, q2: data.q2 ?? 0, q3: data.q3 ?? 0, q4: data.q4 ?? 0,
      notes: data.notes || "",
    };
    if (node) {
      const $tr = $(node);
      const fy  = $tr.find("select.dt-fiscalYear");
      if (fy.length) row.fiscalYear = fy.val() as string;
      (["q1","q2","q3","q4"] as const).forEach(col => {
        const inp = $tr.find(`input.dt-${col}`);
        if (inp.length) row[col] = Number(inp.val()) || 0;
      });
      const n = $tr.find("input.dt-notes");
      if (n.length) row.notes = n.val() as string || "";
    }
    rows.push(row);
  }
  rows.sort((a,b) => ALL_FISCAL_YEARS.indexOf(a.fiscalYear) - ALL_FISCAL_YEARS.indexOf(b.fiscalYear));
  nextId = (rows.reduce((m,r) => Math.max(m, r._id||0), 0)) + 1;
  return rows;
}

function rebuildFiscalYearDropdowns() {
  const rows    = getRowsFromTable();
  const usedFYs = new Set(rows.map(r => r.fiscalYear));
  $("#gridTable tbody tr").each(function () {
    const $sel = $(this).find("select.dt-fiscalYear");
    if (!$sel.length) return;
    const cur  = $sel.val() as string;
    const opts = ALL_FISCAL_YEARS
        .filter(fy => !usedFYs.has(fy) || fy === cur)
        .map(fy => `<option value="${esc(fy)}" ${fy === cur ? "selected" : ""}>${esc(fy)}</option>`)
        .join("");
    $sel.html(opts);
  });
}

function renderTable(initial: BudgetRow[]) {
  suppressDirty = true;
  if ($.fn.dataTable.ext.search.length > 0) $.fn.dataTable.ext.search.length = 0;
  if (dt) { try { dt.destroy(false); } catch {} dt = null; }

  const sorted = [...initial].sort((a,b) =>
      ALL_FISCAL_YEARS.indexOf(a.fiscalYear) - ALL_FISCAL_YEARS.indexOf(b.fiscalYear)
  );

  const columns = [
    {
      data: "fiscalYear", title: "Fiscal Year", width: "120px",
      render: (_d: string, type: string, row: BudgetRow) => {
        if (type !== "display") return row.fiscalYear;
        // Build usedFYs from known data, not DOM — DOM may not exist yet during initial render
        const usedFYs = new Set(sorted.map(r => r.fiscalYear));
        return buildFYSelect(row.fiscalYear, usedFYs);
      }
    },
    { data:"q1", title:"Q1 ($)", width:"110px", type:"num", render:(d:number,type:string)=>type!=="display"?(Number(d)||0):numCell("q1",d) },
    { data:"q2", title:"Q2 ($)", width:"110px", type:"num", render:(d:number,type:string)=>type!=="display"?(Number(d)||0):numCell("q2",d) },
    { data:"q3", title:"Q3 ($)", width:"110px", type:"num", render:(d:number,type:string)=>type!=="display"?(Number(d)||0):numCell("q3",d) },
    { data:"q4", title:"Q4 ($)", width:"110px", type:"num", render:(d:number,type:string)=>type!=="display"?(Number(d)||0):numCell("q4",d) },
    { data:"notes", title:"Notes", render:(d:string,type:string)=>type!=="display"?(d||""):textCell("notes",d) },
    { data:null, title:"Actions", width:"80px", orderable:false, defaultContent:`<button class="azdo-btn btn-remove" type="button" aria-label="Delete row">Delete</button>` },
  ];

  dt = new DataTable("#gridTable", {
    data:      sorted,
    columns,
    paging:    false,
    searching: false,
    info:      false,
    ordering:  false,
    initComplete: function () {
      const tfoot = document.createElement("tfoot");
      tfoot.innerHTML = `<tr class="totals-row"><td colspan="7"></td></tr>`;
      document.getElementById("gridTable")!.appendChild(tfoot);
      updateFooterTotals(sorted);
    },
  });

  try {
    const all = dt.rows().data().toArray() as BudgetRow[];
    nextId = (all.reduce((m:number,r:BudgetRow)=>Math.max(m,r._id||0),0))+1;
  } catch { nextId = sorted.length+1; }

  $("#gridTable tbody")
      .off("input.fin change.fin click.fin")
      .on("change.fin","select.dt-fiscalYear", function() {
        if (!suppressDirty) { rebuildFiscalYearDropdowns(); markDirty(); refreshSummary(); }
      })
      .on("input.fin","input",() => { if (!suppressDirty) markDirty(); })
      .on("change.fin","input",() => { if (!suppressDirty) refreshSummary(); })
      .on("click.fin","button.btn-remove", function() {
        dt.row($(this).closest("tr")).remove().draw(false);
        if (!suppressDirty) { rebuildFiscalYearDropdowns(); markDirty(); refreshSummary(); resizeIframe(); }
      });

  resizeIframe();
  setTimeout(() => { suppressDirty = false; }, 500);
}

function resizeIframe() {
  const h = document.getElementById("app")?.scrollHeight ?? 720;
  SDK.resize(undefined, h);
}

async function readApprovedBudget(): Promise<number> {
  if (!workItemService) return cachedApprovedBudget;

  // Build candidate list: configured field first, then known fallbacks.
  // Following Microsoft's pattern — getFieldValue with known reference name strings.
  // Fallbacks handle the case where Options panel config is null or holds wrong name.
  // Use configured ref if set, otherwise fall back to Custom.EstimatedBudget
  const candidates = Array.from(new Set([
    config.approvedBudgetFieldRef ?? "Custom.EstimatedBudget",
  ]));

  for (const candidate of candidates) {
    try {
      const val = await workItemService.getFieldValue(candidate);
      // Explicit null/undefined/empty guard — Number(null)=0 passes !isNaN
      if (val === null || val === undefined || val === "") {
        log("readApprovedBudget: empty for", candidate);
        continue;
      }
      const n = Number(val);
      if (!isNaN(n)) {
        log("readApprovedBudget: resolved", candidate, "=", n);
        cachedApprovedBudget = n;
        // Lock in the working ref for future calls in this session
        config.approvedBudgetFieldRef = candidate;
        return n;
      }
    } catch {
      // Field does not exist on this WIT — try next candidate silently
    }
  }

  warn("readApprovedBudget: no candidate returned a value. Tried:", candidates.join(", "));
  return cachedApprovedBudget;
}

async function writeComputedFields(summary: FinancialSummary): Promise<void> {
  if (!workItemService) return;
  // Always write all three fields — writing 0 clears stale values when approved budget is removed
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

async function refreshSummary(): Promise<void> {
  const rows    = getRowsFromTable();
  const approved = await readApprovedBudget();
  const summary  = computeFinancials(rows, approved);
  renderSummary(summary);
  updateFooterTotals(rows);
}

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
      // Reuse rows already read above — no second DOM read
      const approved = await readApprovedBudget();
      const summary  = computeFinancials(rows, approved);
      renderSummary(summary);
      updateFooterTotals(rows);
      await writeComputedFields(summary);
    } catch(e: any) { setStatus("Auto-save error: " + (e?.message ?? String(e))); }
  }, 400);
}

async function saveToField() {
  if (!workItemService) return;
  flushDirty(); // Cancel any pending debounce — this save captures current state
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
    updateFooterTotals(rows);
    await writeComputedFields(summary);
    setStatus("Saved");
    setTimeout(() => setStatus("Ready"), 3000);
  } catch(err: any) { setStatus("Save error: " + (err?.message ?? String(err))); }
}

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
  // Sort once here so renderTable, summary, and footer all use the same ordered data
  rows.sort((a,b) => ALL_FISCAL_YEARS.indexOf(a.fiscalYear) - ALL_FISCAL_YEARS.indexOf(b.fiscalYear));
  renderTable(rows);
  const approved = await readApprovedBudget();
  const summary  = computeFinancials(rows, approved);
  renderSummary(summary);
  updateFooterTotals(rows);
  // suppressDirty is released by renderTable's 500ms timer — no competing timer here
}

function addNewRow() {
  if (!dt) return;
  const rows      = getRowsFromTable();
  const available = availableFiscalYears(rows);
  if (available.length === 0) {
    setStatus("All fiscal years have been added.");
    setTimeout(() => setStatus("Ready"), 3000);
    return;
  }
  const nextFY: string = nextFiscalYear(rows);
  dt.row.add({ _id:nextId++, fiscalYear:nextFY, q1:0, q2:0, q3:0, q4:0, notes:"" }).draw(false);
  rebuildFiscalYearDropdowns();
  resizeIframe();
  if (!suppressDirty) {
    refreshSummary(); // Update footer totals immediately (new row has zero values)
    markDirty();
  }
}

async function probeField(svc: IWorkItemFormService, ref: string): Promise<string | null> {
  // Only verify the field is readable — no write test to avoid triggering onFieldChanged on load
  const variants = [ref, ref.replace(/Json$/,"JSON"), ref.replace(/JSON$/,"Json")];
  for (const f of variants) {
    try { await svc.getFieldValue(f); return f; } catch {}
  }
  return null;
}

const provider = () => ({
  onLoaded: async () => {
    try {
      setStatus("Loading...");
      config          = readConfig();
      workItemService = await SDK.getService<IWorkItemFormService>(WorkItemTrackingServiceIds.WorkItemFormService);
      // Diagnostic: log all numeric fields so the exact ref name is visible in console
      try {
        const allFields = await workItemService.getFields();
        const numericFields = (allFields as any[])
            .filter(f => f.type === 2 || f.type === 1) // Double=2, Integer=1
            .map(f => `${f.referenceName} ("${f.name}")`);
        warn("Numeric fields on this WIT:", numericFields.join(" | "));
      } catch(e) { log("getFields diagnostic failed:", e); }

      const resolved  = await probeField(workItemService, config.dataFieldRef);
      if (resolved) { config.dataFieldRef = resolved; }
      else { setStatus(`Field not writable: ${config.dataFieldRef}`); }

      // Probe approved budget field — warn if unreadable so user can diagnose
      if (config.approvedBudgetFieldRef) {
        try {
          await workItemService.getFieldValue(config.approvedBudgetFieldRef);
        } catch(e) {
          warn("Approved Budget field unreadable:", config.approvedBudgetFieldRef, e);
          setStatus(`Cannot read Approved Budget field: ${config.approvedBudgetFieldRef}`);
          // Keep the ref — do not null it, allows retry on next interaction
        }
      }

      document.getElementById("addRowBtn")!.addEventListener("click", addNewRow);
      document.getElementById("saveBtn")!.addEventListener("click", saveToField);
      await loadFromField();
      resizeIframe();
      setStatus("Ready");
    } catch(e:any) { setStatus("Load error: " + (e?.message ?? String(e))); }
  },

  onFieldChanged: async (args: any) => {
    const changed = args?.changedFields ?? {};
    if (!Object.keys(changed).length) return;

    // Count and consume all echo fields in this batch first (SDK may batch multiple writes)
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
        // Check if there are any non-echo fields in this batch to process below
        const hasNonEcho = Object.keys(changed).some(f => !echoFields.includes(f));
        if (!hasNonEcho) return;
      }
    }

    // Data field changed by someone else (not our echo) — reload
    if (changed[config.dataFieldRef] !== undefined && skipFieldChangeOnce === 0) {
      await loadFromField();
      return;
    }

    // Approved budget changed externally — recalculate summary
    if (config.approvedBudgetFieldRef && changed[config.approvedBudgetFieldRef] !== undefined) {
      cachedApprovedBudget = Number(changed[config.approvedBudgetFieldRef]) || 0;
      await refreshSummary();
    }
  },

  onSaved: async () => {
    // Flush any pending debounce — work item may have been saved before 400ms elapsed
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