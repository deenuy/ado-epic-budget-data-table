# ============================================================
# ADO Epic Budget Table — Makefile
# Usage:
#   make release-patch MSG="bug fix description"
#   make release-minor MSG="new feature description"
#   make release-major MSG="breaking change description"
#   make build
#   make package
#   make publish
#   make clean
# ============================================================

# Read current version from vss-extension.json
CURRENT := $(shell python3 -c "import json; print(json.load(open('vss-extension.json'))['version'])")

# Parse major, minor, patch from current version
MAJOR   := $(shell echo $(CURRENT) | cut -d. -f1)
MINOR   := $(shell echo $(CURRENT) | cut -d. -f2)
PATCH   := $(shell echo $(CURRENT) | cut -d. -f3)

# Compute next versions
NEXT_PATCH := $(MAJOR).$(MINOR).$(shell python3 -c "print($(PATCH) + 1)")
NEXT_MINOR := $(MAJOR).$(shell python3 -c "print($(MINOR) + 1)").0
NEXT_MAJOR := $(shell python3 -c "print($(MAJOR) + 1)").0.0

MSG ?= "Release"

.PHONY: release-patch release-minor release-major \
        build package publish tag bump clean help

# ── Default ──────────────────────────────────────────────────
all: help

# ── Release targets ──────────────────────────────────────────
release-patch:
	@$(MAKE) _release VERSION=$(NEXT_PATCH) TYPE=patch

release-minor:
	@$(MAKE) _release VERSION=$(NEXT_MINOR) TYPE=minor

release-major:
	@$(MAKE) _release VERSION=$(NEXT_MAJOR) TYPE=major

# ── Internal release pipeline ────────────────────────────────
_release: _bump build package _tag
	@echo ""
	@echo "========================================"
	@echo "  Release v$(VERSION) complete"
	@echo "  vsix  -> releases/deenuy.ado-epic-budget-data-table-$(VERSION).vsix"
	@echo "  tag   -> v$(VERSION) pushed to origin"
	@echo "========================================"

# ── Bump version in both manifest files ──────────────────────
_bump:
	@echo "Bumping $(CURRENT) -> $(VERSION)..."
	@python3 -c "\
import json; \
[open(f,'w').write(json.dumps({**json.load(open(f)), 'version': '$(VERSION)'}, indent=2) + '\n') \
or print(f'  {f} -> $(VERSION)') \
for f in ['vss-extension.json', 'package.json']]"

# ── Build ─────────────────────────────────────────────────────
build:
	@echo "Building..."
	@npm run build

# ── Package into .vsix and move to releases/ ──────────────────
package:
	@echo "Packaging..."
	@npx tfx-cli extension create --manifest-globs vss-extension.json
	@mkdir -p releases
	@mv deenuy.ado-epic-budget-data-table-*.vsix releases/
	@echo "Packaged -> releases/"

# ── Git commit, tag and push ──────────────────────────────────
_tag:
	@echo "Tagging v$(VERSION)..."
	@git add vss-extension.json package.json
	@git commit -m "chore: bump version to $(VERSION)"
	@git tag -a v$(VERSION) -m "Release v$(VERSION) — $(MSG)"
	@git push origin main
	@git push origin v$(VERSION)
	@echo "Pushed tag v$(VERSION)"

# ── Publish to Marketplace ────────────────────────────────────
publish:
	@echo "Publishing to Marketplace..."
	@npx tfx-cli extension publish \
		--manifest-globs vss-extension.json \
		--token $(MARKETPLACE_TOKEN)

# ── Clean build output ────────────────────────────────────────
clean:
	@echo "Cleaning dist/..."
	@rm -rf dist/

# ── Help ──────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  ADO Epic Budget Table — Release Makefile"
	@echo "  Current version: $(CURRENT)"
	@echo ""
	@echo "  Release commands:"
	@echo "    make release-patch MSG=\"bug fix\"        $(CURRENT) -> $(NEXT_PATCH)"
	@echo "    make release-minor MSG=\"new feature\"    $(CURRENT) -> $(NEXT_MINOR)"
	@echo "    make release-major MSG=\"breaking change\" $(CURRENT) -> $(NEXT_MAJOR)"
	@echo ""
	@echo "  Other commands:"
	@echo "    make build      webpack build only"
	@echo "    make package    build and package .vsix into releases/"
	@echo "    make publish    publish to VS Marketplace (requires MARKETPLACE_TOKEN)"
	@echo "    make clean      remove dist/"
	@echo ""