# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/).

## [1.1.2] - 2026-05-03

### Performance
- Replaced per-cell event listeners with a single delegated handler on #tableWrap — reduces listener allocations from ~144 to 3 per render.
- Cached `Intl.NumberFormat` instance to avoid recreating formatting internals on every currency call.
- Cleared suppressDirty timer before each new render to prevent races between rapid add/remove operations.

### Added
- Dynamic currency symbol support — reads ISO 4217 code from `Custom.Currency` field and formats all monetary values accordingly (supports USD, EUR, GBP, INR, JPY, CAD, AUD and 15+ others).
- Save concurrency guard — `runSave()` helper prevents overlapping writes when debounced auto-save and explicit save fire simultaneously.
- Initialized guard in `onLoaded` to prevent duplicate button wiring if the control is re-mounted.
- FY row validation and deduplication on load — protects against corrupted JSON from manual edits or migrations.

### Fixed
- Replaced deprecated `getFieldValue(ref, boolean)` calls with `getFieldValues([ref])` batch API.
- Added `void` to unhandled Promise returns from `refreshSummary` and `SDK.ready().then()`.
- Single-quote escaping added to `esc()` for defense-in-depth.
- Failure-path decrement in `writeComputedFields` — skipFieldChangeOnce now correctly decrements when a field write fails.

### Changed
- Computed fields (Total Committed Spend, Total Budget Remaining, PercentOfBudget) marked read-only via `setFieldOptions` on load — prevents accidental manual edits.
- Removed temporary `getFields()` diagnostic from `onLoaded` — field reference names confirmed in production.
- `textContent` used instead of `innerHTML` in `updateFYTotal` for safety and performance.

## [1.1.1] - 2026-05-03

### Added
- Transposed budget grid — fixed Q1/Q2/Q3/Q4 rows with dynamic fiscal year columns.
- FY TOTAL footer row showing per-column spend total.
- Add FY button adds next sequential fiscal year as a new column.
- Delete button per fiscal year column.
- Removed DataTables dependency — replaced with plain HTML table rendering.
- Full JSDoc comments and inline documentation on all functions and module-level state.

### Fixed
- Approved Budget showing $0 — added null/undefined guard before `Number()` conversion in `readApprovedBudget()`.
- Hard-coded fallback to `Custom.EstimatedCost` when `approvedBudgetFieldRef` is null.
- Summary banner label renamed from "Approved Budget" to "Estimated Cost" to match the actual field.
- `probeField` no longer writes back field value on load — eliminates race condition and dirty flag on open.
- `destroy(false)` used instead of `destroy(true)` to preserve table DOM element between reloads.
- Unified `onFieldChanged` echo guard — processes all echo fields in one pass before reacting to real changes.
- `skipFieldChangeOnce` counter decrements by matched field count, not always by 1.
- Removed competing `suppressDirty` timer from `loadFromField` — `renderTable` is the single owner.
- Debounce flush added to `saveToField` and `onSaved` to prevent last edit being lost on rapid save.
- `nextFiscalYear()` simplified — returns next sequential year after highest used, fixing FY25-after-FY28 bug.
- Footer grand total removed from footer row — was misaligned under Notes column; grand total shown in banner.

### Changed
- `SDK.resize()` replaced with `resizeIframe()` which measures actual `#app scrollHeight` — iframe no longer resets to layout-defined height after work item Save.
- `warn()` function added — always logs errors to console regardless of DEBUG flag.
- `onSaved` calls `resizeIframe()` after 300ms to handle AzDO post-save re-render.

## [1.0.8] - 2026-05-03

### Fixed
- Manifest: removed redundant `vso.work` scope (`vso.work_write` inherits it).
- Manifest: corrected `workItemFieldTypes` casing from `Html` to `HTML`.
- Manifest: removed `DataFieldRefNameText` dead code from `readConfig()`.
- Manifest: added `LICENSE` to `files` array.

### Added
- Manifest: `$schema`, `tags`, and top-level `repository` property for Marketplace discoverability.

## [1.0.6] - 2026-05-03

### Fixed
- `getFieldValue` no longer accepts `null` from unset fields as valid — explicit null/undefined/empty guard added before `Number()` conversion.
- Approved budget field probed in `onLoaded` with visible warning on failure.
- `warn()` function introduced for always-visible production error logging.

## [1.0.5] - 2026-05-03

### Changed
- Control height set to 720px in manifest — shows at least 5 fiscal year rows without scrolling.
- `SDK.resize()` called dynamically using actual content height after every render, row add/delete, and work item Save.

## [1.0.4] - 2026-05-03

### Fixed
- Fiscal year strict ordering enforced — rows always sorted ascending, ordering locked.
- Duplicate fiscal years blocked — FY dropdown shows only available years.
- Add Row defaults to next sequential FY after the highest used year.
- Pagination removed (`paging: false`, `info: false`) — all rows visible without scroll.
- Remaining and % of Budget show dash when no approved budget is set.

## [1.0.3] - 2026-05-03

### Changed
- Simplified budget grid — removed Cost Category and Type columns. Grid now shows Fiscal Year, Q1-Q4, Notes, Actions.
- Extended Fiscal Year dropdown range to FY40.

### Fixed
- Approved Budget field showing $0 when field reference name had a casing mismatch.
- Footer totals colspan corrected from 9 to 7 to match reduced column count.

### Removed
- `costCat` and `expenseType` columns from budget grid, `BudgetRow` interface, and all related data mappers.

## [1.0.2] - 2026-05-03

### Fixed
- Removed SVG file from images/ directory — Marketplace rejects SVG assets.
- Corrected webpack CopyPlugin pattern to exclude non-PNG files from dist/images/.

## [1.0.1] - 2026-05-03

### Fixed
- Trimmed vss-extension.json description to under 200 characters (Marketplace limit).
- Added missing overview.md required by extension packager.

## [1.0.0] - 2026-05-03

### Added
- Initial release of ADO Epic Budget Table extension.
- Editable budget grid: Fiscal Year x Q1-Q4 amounts x Notes per row.
- Financial summary banner: Approved Budget, Total Planned Spend, Remaining, % of Budget with RAG progress bar.
- Footer totals row: per-quarter sums and grand total.
- Auto-save with 300ms debounce — no manual Save required for normal use.
- Field writeback: computed KPIs written to queryable Epic decimal fields.
- Azure DevOps light/dark mode support via CSS custom properties.
- Published to Visual Studio Marketplace under publisher deenuy.