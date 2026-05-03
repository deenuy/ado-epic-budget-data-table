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
