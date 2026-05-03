# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.3] - 2026-05-03

### Changed
- Simplified budget grid — removed Cost Category and Type columns for a
  cleaner, wider layout. Grid now shows Fiscal Year, Q1-Q4, Notes, Actions.
- Extended Fiscal Year dropdown range to FY40.

### Fixed
- Approved Budget field showing $0 when field reference name had a casing
  mismatch. readApprovedBudget() now tries multiple field name variants
  before falling back, resolving the mismatch automatically.
- Footer totals colspan corrected from 9 to 7 to match the reduced column count.

### Removed
- costCat (Cost Category) column and expenseType (Type) column from the
  budget grid, BudgetRow interface, and all related data mappers.

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
- Financial summary banner: Approved Budget, Total Planned Spend, Remaining,
  % of Budget with RAG progress bar.
- Footer totals row: per-quarter sums and grand total.
- Auto-save with 300ms debounce — no manual Save required for normal use.
- Field writeback: computed KPIs written to queryable Epic decimal fields.
- Azure DevOps light/dark mode support via CSS custom properties.
- Published to Visual Studio Marketplace under publisher deenuy.