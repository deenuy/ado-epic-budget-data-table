# ============================================================
# ADO Epic Budget Table — Makefile
# Update version manually in vss-extension.json and package.json
# then run:
#   make release MSG="your release notes"
#   make build
#   make package
# ============================================================

VERSION := $(shell python3 -c "import json; print(json.load(open('vss-extension.json'))['version'])")
MSG     ?= "Release v$(VERSION)"
VSIX    := deenuy.ado-epic-budget-data-table-$(VERSION).vsix

.PHONY: release build package tag clean help

# ── Default ──────────────────────────────────────────────────
all: help

# ── Full release pipeline ─────────────────────────────────────
release: build package tag
	@echo ""
	@echo "========================================"
	@echo "  Release v$(VERSION) complete"
	@echo "  vsix -> releases/$(VSIX)"
	@echo "  tag  -> v$(VERSION) pushed to origin"
	@echo "========================================"

# ── Build ─────────────────────────────────────────────────────
build:
	@echo "Building v$(VERSION)..."
	npm run build

# ── Package .vsix into releases/ ──────────────────────────────
package:
	@echo "Packaging v$(VERSION)..."
	npx tfx-cli extension create --manifest-globs vss-extension.json
	mkdir -p releases
	mv $(VSIX) releases/
	@echo "Done -> releases/$(VSIX)"

# ── Git commit, tag and push ──────────────────────────────────
tag:
	@echo "Tagging v$(VERSION)..."
	git add vss-extension.json package.json
	git commit -m "chore: release v$(VERSION)"
	git tag -a v$(VERSION) -m "$(MSG)"
	git push origin main
	git push origin v$(VERSION)

# ── Clean build output ────────────────────────────────────────
clean:
	rm -rf dist/

# ── Help ──────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  ADO Epic Budget Table — Makefile"
	@echo "  Current version: $(VERSION)"
	@echo ""
	@echo "  Steps to release:"
	@echo "    1. Update version in vss-extension.json and package.json"
	@echo "    2. make release MSG=\"what changed\""
	@echo ""
	@echo "  Individual commands:"
	@echo "    make build    webpack build only"
	@echo "    make package  build and package .vsix into releases/"
	@echo "    make tag      git commit, tag and push"
	@echo "    make clean    remove dist/"
	@echo ""