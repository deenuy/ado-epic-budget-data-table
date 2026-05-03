#!/usr/bin/env bash
# =============================================================================
# finish-repo.sh
# Run from the root of ado-epic-budget-data-table to complete the repo setup.
# Usage:  bash finish-repo.sh
# =============================================================================

set -euo pipefail

GITHUB_USERNAME="deenuy"   # ← update if your GitHub handle differs
REPO_NAME="ado-epic-budget-data-table"

echo "🏗  Finishing repo setup for ${REPO_NAME}..."

# ─────────────────────────────────────────────────────────────────────────────
# 1. .gitignore
# ─────────────────────────────────────────────────────────────────────────────
cat > .gitignore << 'EOF'
# Node
node_modules/
npm-debug.log*

# Build output — never commit generated files
dist/
*.vsix

# Environment & secrets
.env
.env.local
*.token

# IDE
.idea/
.vscode/
*.iml
.venv/
__pycache__/

# OS
.DS_Store
Thumbs.db

# TypeScript cache
*.tsbuildinfo
EOF
echo "✅  .gitignore"

# ─────────────────────────────────────────────────────────────────────────────
# 2. GitHub Actions — CI (build on every PR / push to main)
# ─────────────────────────────────────────────────────────────────────────────
mkdir -p .github/workflows .github/ISSUE_TEMPLATE

cat > .github/workflows/ci.yml << 'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload dist
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 7
EOF
echo "✅  .github/workflows/ci.yml"

# ─────────────────────────────────────────────────────────────────────────────
# 3. GitHub Actions — Release (auto-publish on version tag)
# ─────────────────────────────────────────────────────────────────────────────
cat > .github/workflows/release.yml << 'EOF'
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    name: Publish to Marketplace
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install tfx-cli
        run: npm install -g tfx-cli

      - name: Build
        run: npm run build

      - name: Publish to Marketplace
        run: |
          npx tfx-cli extension publish \
            --manifest-globs vss-extension.json \
            --token ${{ secrets.MARKETPLACE_TOKEN }}
EOF
echo "✅  .github/workflows/release.yml"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Issue templates
# ─────────────────────────────────────────────────────────────────────────────
cat > .github/ISSUE_TEMPLATE/bug_report.md << 'EOF'
---
name: Bug Report
about: Something isn't working as expected
title: '[Bug] '
labels: bug
assignees: ''
---

## Describe the bug
A clear description of what went wrong.

## Steps to reproduce
1. Go to '...'
2. Click '...'
3. See error

## Expected behaviour
What you expected to happen.

## Actual behaviour
What actually happened.

## Environment
- Azure DevOps: [ ] Services  [ ] Server (version: ___)
- Extension version:
- Browser:
- Theme: [ ] Light  [ ] Dark

## Console errors
<!-- Open F12 → Console, paste any red errors here -->

## Additional context
<!-- Field configuration, number of rows, etc. -->
EOF

cat > .github/ISSUE_TEMPLATE/feature_request.md << 'EOF'
---
name: Feature Request
about: Suggest an improvement or new capability
title: '[Feature] '
labels: enhancement
assignees: ''
---

## Problem this solves
What pain point or gap does this address?

## Proposed solution
Describe your idea clearly.

## Alternatives considered
Other approaches you thought about.

## Who would benefit?
e.g. "PMO managers tracking multi-year programmes"

## Additional context
Screenshots, mockups, or links to similar extensions are very welcome.
EOF
echo "✅  Issue templates"

# ─────────────────────────────────────────────────────────────────────────────
# 5. Pull Request template
# ─────────────────────────────────────────────────────────────────────────────
cat > .github/pull_request_template.md << 'EOF'
## What does this PR do?
<!-- One-line summary -->

## Why?
<!-- Link the issue this closes: Closes #123 -->

## Type of change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactor / cleanup
- [ ] CI / tooling

## Checklist
- [ ] `npm run build` passes with no TypeScript errors
- [ ] Tested against a real Azure DevOps org (sandbox is fine)
- [ ] `suppressDirty` / `skipFieldChangeOnce` guards respected
- [ ] `computeFinancials()` remains a pure function (no SDK/DOM deps added)
- [ ] README updated if behaviour or setup steps changed
- [ ] No `dist/` files committed
EOF
echo "✅  .github/pull_request_template.md"

# ─────────────────────────────────────────────────────────────────────────────
# 6. README.md
# ─────────────────────────────────────────────────────────────────────────────
cat > README.md << README
<div align="center">

# 📊 ADO Epic Budget Table

**Financial budget planning — built directly into Azure DevOps Epic work items.**

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/${GITHUB_USERNAME}.ado-epic-budget-data-table?label=Marketplace&color=0078d4)](https://marketplace.visualstudio.com/items?itemName=${GITHUB_USERNAME}.ado-epic-budget-data-table)
[![GitHub Stars](https://img.shields.io/github/stars/${GITHUB_USERNAME}/${REPO_NAME}?style=flat&color=ffd700)](https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/stargazers)
[![Build](https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/actions/workflows/ci.yml/badge.svg)](https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[**Install from Marketplace**](https://marketplace.visualstudio.com/items?itemName=${GITHUB_USERNAME}.ado-epic-budget-data-table) · [**Quick Start**](#quick-start) · [**Contribute**](CONTRIBUTING.md)

</div>

---

## The problem

Project managers in Azure DevOps have no native way to plan and track budget spend by **fiscal year and quarter** on an Epic. The typical workarounds — Excel files, SharePoint lists, Power BI datasets — live outside the work item, break traceability, and require separate maintenance.

This extension puts a full budget planning table **directly on the Epic's Financials tab**, auto-computes your financial KPIs, and writes results to **queryable Epic decimal fields** — so WIQL queries, dashboards, and backlog rollups reflect real budget data with no external tooling.

---

## What you get

| Feature | Detail |
|---|---|
| **Editable budget grid** | One row per cost line — Fiscal Year, Cost Category, Expense Type (CapEx/OpEx), Q1–Q4 amounts, Notes |
| **Financial summary banner** | Approved Budget · Total Planned Spend · Remaining · % of Budget with a RAG colour-coded progress bar |
| **Footer totals** | Per-quarter sums + grand total, always in sync as you type |
| **Auto-save** | Rows persist to a backing Epic field on a 300ms debounce — no Save button required |
| **Field writeback** | Computed KPIs written to native Epic decimal fields, making them queryable via WIQL |
| **Light / dark mode** | Respects Azure DevOps theme automatically |
| **No Power BI. No Power Automate. No external databases.** | |

---

## Quick Start

### 1 — Install the extension

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=${GITHUB_USERNAME}.ado-epic-budget-data-table).

### 2 — Create Epic fields

In **Organization Settings → Process → [Your Process] → Epic**, create:

| Field Name | Type | Reference Name |
|---|---|---|
| Financials Table JSON | Text (multiple lines) | \`Custom.FinancialsTableJson\` |
| Total Planned Spend | Decimal | \`Custom.TotalPlannedSpend\` |
| Budget Remaining | Decimal | \`Custom.BudgetRemaining\` |
| Percent of Budget | Decimal | \`Custom.PercentOfBudget\` |

> **Tip:** Reuse your existing **Estimated Cost** or **Approved Budget** field as the approved budget source — no new field needed.

### 3 — Add a Financials page to the Epic layout

1. **Organization Settings → Process → [Your Process] → Epic**
2. Click **New page** → name it \`Financials\`
3. Click **Add custom control** → select **ADO Epic Budget Table**

### 4 — Configure the control options

| Input | Value |
|---|---|
| JSON Storage Field | \`Custom.FinancialsTableJson\` |
| Approved Budget Field | *(reference name of your Estimated Cost field)* |
| Total Planned Spend Field | \`Custom.TotalPlannedSpend\` |
| Budget Remaining Field | \`Custom.BudgetRemaining\` |
| Percent of Budget Field | \`Custom.PercentOfBudget\` |

### 5 — Open any Epic → Financials tab

Add rows, enter quarterly amounts, watch the summary update live.

---

## Querying budget data (no Power BI needed)

Because computed values are written to native Epic decimal fields, you can query them in WIQL:

\`\`\`sql
SELECT [System.Id], [System.Title],
       [Custom.TotalPlannedSpend],
       [Custom.BudgetRemaining],
       [Custom.PercentOfBudget]
FROM WorkItems
WHERE [System.WorkItemType] = 'Epic'
  AND [Custom.PercentOfBudget] >= 90
ORDER BY [Custom.PercentOfBudget] DESC
\`\`\`

Use this as a **Work Item Query Chart** widget on your Azure DevOps dashboard — no additional tooling required.

---

## Local development

\`\`\`bash
git clone https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git
cd ${REPO_NAME}
npm install
npm run build       # production bundle → dist/
npm run dev         # watch mode
npm run package     # creates .vsix for manual upload
\`\`\`

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development guide.

---

## Roadmap

- [ ] Multi-currency support with per-row currency selector
- [ ] Actuals columns (Q1–Q4 Actual vs Planned variance)
- [ ] Export budget table to CSV
- [ ] Portfolio dashboard widget — aggregate across Epics via WIQL
- [ ] Lock rows by Epic state (read-only when Approved)
- [ ] Jest unit tests for \`computeFinancials\`

See [open issues](https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/issues) to pick something up.

---

## Contributing

Contributions of all sizes are welcome — from fixing a typo to building a roadmap feature.

Read the **[Contributing Guide](CONTRIBUTING.md)** to get started.

---

## License

[MIT](LICENSE) — free to use, modify, and distribute.

---

## Author

Built by **Deenu Gengiti** — ML Engineer & Technical Lead at Emerson Electric Co.

If this saves your team time:
- ⭐ **Star this repo** — helps others find it
- 📝 **Leave a review** on the [VS Marketplace](https://marketplace.visualstudio.com/items?itemName=${GITHUB_USERNAME}.ado-epic-budget-data-table)
- 🐛 **File issues** — every bug report makes the extension better

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?logo=linkedin)](https://linkedin.com/in/deenu-gengiti)

README
echo "✅  README.md"

# ─────────────────────────────────────────────────────────────────────────────
# 7. CONTRIBUTING.md
# ─────────────────────────────────────────────────────────────────────────────
cat > CONTRIBUTING.md << 'EOF'
# Contributing to ADO Epic Budget Table

Thank you for contributing. This extension is used by PMO teams in enterprise Azure DevOps organizations — quality matters.

## Ways to contribute

| | How |
|---|---|
| 🐛 Report a bug | [Open a Bug Report](../../issues/new?template=bug_report.md) |
| 💡 Suggest a feature | [Open a Feature Request](../../issues/new?template=feature_request.md) |
| 📖 Improve docs | Edit any `.md` file and open a PR |
| ⭐ Spread the word | Star the repo, review on the Marketplace |

## Development setup

**Prerequisites:** Node.js 18+, npm 9+, a free [Azure DevOps organization](https://dev.azure.com) for testing.

```bash
git clone https://github.com/deenuy/ado-epic-budget-data-table.git
cd ado-epic-budget-data-table
npm install
npm run build
```

## Making changes

1. **Find or open an issue** before starting significant work
2. **Fork** the repo and create a branch: `git checkout -b feat/my-feature`
3. Make focused changes — one logical change per PR
4. Run `npm run build` — must compile with zero TypeScript errors
5. Test against a real Azure DevOps org
6. Open a PR against `main` and fill in the template

## Key rules

- **Never write fields on `onLoaded`** — this dirty-flags the work item for every viewer
- **Always increment `skipFieldChangeOnce`** before `setFieldValue` calls to prevent echo loops
- **`computeFinancials()` must stay pure** — no SDK, DOM, jQuery, or DataTables dependencies
- **Never commit `dist/`** — it is built by CI

## Commit conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(calculator): add year-over-year grouped totals
fix(writeback): correct skipFieldChangeOnce increment count
docs: add WIQL query example to README
chore: update datatables.net to 2.4.0
```

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be respectful.
EOF
echo "✅  CONTRIBUTING.md"

# ─────────────────────────────────────────────────────────────────────────────
# 8. CODE_OF_CONDUCT.md (Contributor Covenant 2.1 — condensed)
# ─────────────────────────────────────────────────────────────────────────────
cat > CODE_OF_CONDUCT.md << 'EOF'
# Code of Conduct

## Our Pledge

We pledge to make participation in this community a harassment-free experience for everyone, regardless of age, disability, ethnicity, gender identity, level of experience, nationality, race, religion, or sexual orientation.

## Our Standards

**Encouraged:**
- Empathy and kindness
- Respectful disagreement
- Constructive feedback
- Accepting responsibility and learning from mistakes

**Not acceptable:**
- Sexualised language or imagery
- Trolling, insults, or personal attacks
- Public or private harassment
- Publishing others' private information without permission

## Enforcement

Instances of unacceptable behaviour may be reported to **deenu.gengiti@gmail.com**. All complaints will be reviewed promptly and confidentially.

This Code of Conduct is adapted from the [Contributor Covenant](https://www.contributor-covenant.org), version 2.1.
EOF
echo "✅  CODE_OF_CONDUCT.md"

# ─────────────────────────────────────────────────────────────────────────────
# 9. Update package.json with correct repo metadata
# ─────────────────────────────────────────────────────────────────────────────
# Using Python (available in the .venv) to do a clean JSON update
python3 - << PYEOF
import json, sys

with open("package.json") as f:
    pkg = json.load(f)

pkg["name"]        = "ado-epic-budget-data-table"
pkg["description"] = "Financial budget planning table for Azure DevOps PMO Epics — fiscal year x quarterly spend, auto-computed KPIs, queryable Epic fields."
pkg["author"]      = "Deenu Gengiti"
pkg["license"]     = "MIT"
pkg["repository"]  = {
    "type": "git",
    "url":  "https://github.com/deenuy/ado-epic-budget-data-table.git"
}
pkg["bugs"]     = {"url": "https://github.com/deenuy/ado-epic-budget-data-table/issues"}
pkg["homepage"] = "https://github.com/deenuy/ado-epic-budget-data-table#readme"

# Remove select2 if present
pkg.get("dependencies", {}).pop("select2", None)
pkg.get("dependencies", {}).pop("@types/select2", None)
pkg.get("devDependencies", {}).pop("select2", None)
pkg.get("devDependencies", {}).pop("@types/select2", None)

# Fix publish script to use env var token
if "scripts" in pkg:
    pkg["scripts"]["publish"] = "npm run build && npx tfx-cli extension publish --manifest-globs vss-extension.json --rev-version --token ${MARKETPLACE_TOKEN}"

with open("package.json", "w") as f:
    json.dump(pkg, f, indent=2)
    f.write("\n")

print("package.json updated")
PYEOF
echo "✅  package.json"

# ─────────────────────────────────────────────────────────────────────────────
# 10. Install npm dependencies
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📦  Running npm install..."
npm install
echo "✅  node_modules installed"

# ─────────────────────────────────────────────────────────────────────────────
# 11. Test the build
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "🔨  Running npm run build..."
npm run build
echo "✅  Build succeeded"

# ─────────────────────────────────────────────────────────────────────────────
# 12. Commit everything
# ─────────────────────────────────────────────────────────────────────────────
git add .
git commit -m "chore: complete repo scaffold

- .gitignore (node_modules, dist, .vsix, IDE, secrets)
- README.md with badges, quick start, WIQL example
- CONTRIBUTING.md with dev setup and coding rules
- CODE_OF_CONDUCT.md (Contributor Covenant 2.1)
- GitHub Actions: CI on PR, auto-publish on version tag
- Issue templates: bug report, feature request
- PR template with extension-specific checklist
- package.json: correct metadata, select2 removed
- npm install + build verified"

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "✅  Repo is complete and committed. Final steps:"
echo ""
echo "  1. Create the GitHub remote and push:"
echo "     gh repo create ado-epic-budget-data-table \\"
echo "       --public --source=. --remote=origin --push"
echo "     — or —"
echo "     git remote add origin https://github.com/deenuy/ado-epic-budget-data-table.git"
echo "     git push -u origin main"
echo ""
echo "  2. Add your extension icon (128×128 PNG):"
echo "     images/extension-icon.png"
echo ""
echo "  3. Add MARKETPLACE_TOKEN secret on GitHub:"
echo "     Repo → Settings → Secrets → Actions → New repository secret"
echo "     Name:  MARKETPLACE_TOKEN"
echo "     Value: your Visual Studio Marketplace PAT"
echo ""
echo "  4. Tag and release when ready:"
echo "     git tag v1.0.0 && git push --tags"
echo "══════════════════════════════════════════════════════════════"