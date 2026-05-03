#!/usr/bin/env bash
# =============================================================================
# scaffold.sh — ado-epic-budget-table repo setup
# Run once from the project root after IntelliJ creates the empty project.
# Usage:  bash scaffold.sh
# =============================================================================

set -euo pipefail

echo "🏗  Scaffolding ado-epic-budget-table..."

# ── Directory structure ───────────────────────────────────────────────────────
mkdir -p src
mkdir -p images
mkdir -p dist          # webpack output — gitignored
mkdir -p docs
mkdir -p .github/workflows
mkdir -p .github/ISSUE_TEMPLATE

echo "📁  Directories created"

# ── .gitignore ────────────────────────────────────────────────────────────────
cat > .gitignore << 'EOF'
# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

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

# OS
.DS_Store
Thumbs.db

# TypeScript cache
*.tsbuildinfo
EOF

echo "✅  .gitignore"

# ── LICENSE (MIT) ─────────────────────────────────────────────────────────────
YEAR=$(date +%Y)
cat > LICENSE << EOF
MIT License

Copyright (c) ${YEAR} Deenu Gengiti

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

echo "✅  LICENSE"

# ── SECURITY.md ───────────────────────────────────────────────────────────────
cat > SECURITY.md << 'EOF'
# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅        |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, open a [GitHub private security advisory](../../security/advisories/new)
or email the maintainer directly. We will respond within 48 hours and coordinate
a fix before any public disclosure.
EOF

echo "✅  SECURITY.md"

# ── CHANGELOG.md ─────────────────────────────────────────────────────────────
cat > CHANGELOG.md << 'EOF'
# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - $(date +%Y-%m-%d)

### Added
- Initial release
- Editable budget grid: Fiscal Year × Cost Category × Expense Type × Q1–Q4
- Financial summary banner with RAG progress bar
- Footer totals row (per-quarter + grand total)
- Auto-save with 300ms debounce
- Field writeback: Total Planned Spend, Budget Remaining, % of Budget
- Light / dark mode support
- Azure DevOps Marketplace publication
EOF

echo "✅  CHANGELOG.md"

# ── overview.md (Marketplace listing page) ────────────────────────────────────
cat > overview.md << 'EOF'
# Financial Budget Table for Azure DevOps

Give your PMO budget visibility **directly inside Epic work items** — no Power BI, no spreadsheets, no external tools.

## What it does

Add a **Financials** tab to any Epic. Project managers enter budget rows by Fiscal Year, Cost Category, and Expense Type, and fill in Q1–Q4 spend amounts. The extension automatically:

- Computes **Total Planned Spend**, **Budget Remaining**, and **% of Budget**
- Shows a live **RAG-coloured summary banner** and progress bar
- Writes computed values back to **queryable Epic decimal fields** — WIQL, dashboards, and backlog rollups work without any additional tooling

## Setup (5 minutes)

1. Create five Epic fields (one multiline text for JSON storage, three decimals for computed values)
2. Add a **Financials** page to your Epic layout
3. Drop the control onto the page and configure the five field references in the Options panel
4. Open any Epic → Financials tab → start planning

See the [GitHub repository](https://github.com/YOUR_GITHUB_USERNAME/ado-epic-budget-table) for the full setup guide.

## No external services required

All computation happens in the browser. Data is stored in your Azure DevOps fields. Nothing leaves your organization.
EOF

echo "✅  overview.md"

# ── package.json ──────────────────────────────────────────────────────────────
cat > package.json << 'EOF'
{
  "name": "ado-epic-budget-table",
  "version": "1.0.0",
  "description": "Financial budget planning table for Azure DevOps PMO Epics — fiscal year × quarterly spend, auto-computed KPIs, queryable Epic fields.",
  "author": "Deenu Gengiti",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_GITHUB_USERNAME/ado-epic-budget-table.git"
  },
  "bugs": {
    "url": "https://github.com/YOUR_GITHUB_USERNAME/ado-epic-budget-table/issues"
  },
  "homepage": "https://github.com/YOUR_GITHUB_USERNAME/ado-epic-budget-table#readme",
  "scripts": {
    "build":   "webpack --mode production",
    "dev":     "webpack --mode development --watch",
    "package": "npm run build && npx tfx-cli extension create --manifest-globs vss-extension.json --rev-version",
    "publish": "npm run build && npx tfx-cli extension publish --manifest-globs vss-extension.json --rev-version --token ${MARKETPLACE_TOKEN}"
  },
  "dependencies": {
    "azure-devops-extension-api": "^4.259.0",
    "azure-devops-extension-sdk": "^4.0.2",
    "datatables.net":             "^2.3.3",
    "datatables.net-dt":          "^2.3.3",
    "jquery":                     "^3.7.1"
  },
  "devDependencies": {
    "@types/jquery":        "^3.5.33",
    "@types/node":          "^24.3.0",
    "copy-webpack-plugin":  "^13.0.1",
    "css-loader":           "^7.1.2",
    "html-webpack-plugin":  "^5.6.4",
    "style-loader":         "^4.0.0",
    "ts-loader":            "^9.5.4",
    "typescript":           "^5.9.2",
    "webpack":              "^5.101.3",
    "webpack-cli":          "^6.0.1"
  }
}
EOF

echo "✅  package.json"

# ── tsconfig.json ─────────────────────────────────────────────────────────────
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target":           "ES2019",
    "module":           "ESNext",
    "moduleResolution": "Node",
    "lib":              ["ES2020", "DOM"],
    "strict":           true,
    "noEmitOnError":    true,
    "esModuleInterop":  true,
    "skipLibCheck":     true,
    "sourceMap":        true,
    "typeRoots":        ["./node_modules/@types"],
    "types":            ["jquery"]
  },
  "include": ["src/**/*"]
}
EOF

echo "✅  tsconfig.json"

# ── webpack.config.js ─────────────────────────────────────────────────────────
cat > webpack.config.js << 'EOF'
const path    = require("path");
const Html    = require("html-webpack-plugin");
const Copy    = require("copy-webpack-plugin");
const webpack = require("webpack");

module.exports = {
  entry:   { index: "./src/index.ts" },
  output:  { path: path.resolve(__dirname, "dist"), filename: "[name].js", clean: true },
  mode:    "production",
  devtool: "inline-source-map",
  resolve: { extensions: [".ts", ".js"] },
  module: {
    rules: [
      { test: /\.ts$/,  use: "ts-loader",                    exclude: /node_modules/ },
      { test: /\.css$/, use: ["style-loader", "css-loader"] }
    ]
  },
  plugins: [
    new Html({ template: "src/index.html", chunks: ["index"] }),
    new Copy({ patterns: [{ from: "images", to: "images" }] }),
    new webpack.ProvidePlugin({ $: "jquery", jQuery: "jquery", "window.jQuery": "jquery" })
  ]
};
EOF

echo "✅  webpack.config.js"

# ── GitHub Actions CI ─────────────────────────────────────────────────────────
cat > .github/workflows/ci.yml << 'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    name: Build & package
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

      - name: Upload dist artifact
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 7
EOF

echo "✅  .github/workflows/ci.yml"

# ── GitHub Actions Release (publish on version tag) ──────────────────────────
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

      - name: Package extension
        run: npx tfx-cli extension create --manifest-globs vss-extension.json

      - name: Publish to Marketplace
        run: |
          npx tfx-cli extension publish \
            --manifest-globs vss-extension.json \
            --token ${{ secrets.MARKETPLACE_TOKEN }}
EOF

echo "✅  .github/workflows/release.yml"

# ── Issue templates ───────────────────────────────────────────────────────────
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

## Screenshots / console errors
<!-- Paste F12 console errors here if relevant -->

## Additional context
<!-- e.g. your field configuration, number of rows, column layout -->
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
e.g. "PMO managers tracking multi-year programmes", "finance teams needing actuals vs planned"

## Additional context
Screenshots, mockups, or links to similar extensions are very welcome.
EOF

echo "✅  Issue templates"

# ── Pull Request template ─────────────────────────────────────────────────────
cat > .github/pull_request_template.md << 'EOF'
## What does this PR do?
<!-- One-line summary -->

## Why?
<!-- Link the issue: Closes #123 -->

## Type of change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactor / cleanup
- [ ] CI / tooling

## Checklist
- [ ] `npm run build` passes with no errors
- [ ] Tested against a real Azure DevOps org (sandbox is fine)
- [ ] `suppressDirty` / `skipFieldChangeOnce` guards respected (no write loops)
- [ ] `computeFinancials()` remains a pure function (no SDK/DOM deps added)
- [ ] README updated if behaviour changed
- [ ] No `dist/` files committed
EOF

echo "✅  Pull request template"

# ── Placeholder source files (copy your real files over these) ───────────────
touch src/index.ts
touch src/index.html
touch src/styles.css
touch vss-extension.json
touch images/.gitkeep      # keeps the images/ folder tracked before icon is added
touch docs/.gitkeep

echo "✅  Placeholder source files"

# ── Initial git commit ────────────────────────────────────────────────────────
git add .
git commit -m "chore: initial repo scaffold

- Project structure, .gitignore, LICENSE (MIT)
- package.json, tsconfig.json, webpack.config.js
- GitHub Actions: CI on PR, publish on version tag
- Issue templates (bug, feature), PR template
- CHANGELOG, SECURITY, overview.md stubs"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅  Scaffold complete. Next steps:"
echo ""
echo "  1. Copy your source files into src/:"
echo "       src/index.ts"
echo "       src/index.html"
echo "       src/styles.css"
echo "       vss-extension.json"
echo ""
echo "  2. Add your extension icon:"
echo "       images/extension-icon.png  (128×128 PNG)"
echo ""
echo "  3. Install dependencies:"
echo "       npm install"
echo ""
echo "  4. Test the build:"
echo "       npm run build"
echo ""
echo "  5. Create the GitHub repo and push:"
echo "       gh repo create ado-epic-budget-table --public --source=. --remote=origin --push"
echo "       # or via GitHub.com → New repository → push existing"
echo ""
echo "  6. Add the MARKETPLACE_TOKEN secret in GitHub:"
echo "       GitHub repo → Settings → Secrets → Actions → New secret"
echo "       Name: MARKETPLACE_TOKEN"
echo "       Value: your Visual Studio Marketplace PAT"
echo "═══════════════════════════════════════════════════════"