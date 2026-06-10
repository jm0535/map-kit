.PHONY: help lint format typecheck check build serve clean

help:           ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ── Code quality ──────────────────────────────────────────────────────────

lint:           ## Run Ruff linter
	ruff check .

format:         ## Run Ruff formatter
	ruff format .

typecheck:      ## Run mypy type checker
	mypy src/

check: lint typecheck  ## Run all checks

# ── Build ──────────────────────────────────────────────────────────────────

build:          ## Generate static and interactive maps
	python -m geospax.cli

build-static:   ## Generate static map only
	python -m geospax.cli --static-only

build-interactive: ## Generate interactive map only
	python -m geospax.cli --interactive-only

# ── Serve ──────────────────────────────────────────────────────────────────

serve:          ## Serve Web GIS locally on port 8000
	python -m http.server 8000

# ── Clean ──────────────────────────────────────────────────────────────────

clean:          ## Remove generated files
	rm -f docs/transect_map.png docs/transect_map.html
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
