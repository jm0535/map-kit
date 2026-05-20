# Contributing to map-kit

Thank you for your interest in contributing! This document outlines the standards and workflows for this project.

## Development Setup

```bash
# Clone and enter the repo
git clone git@github.com:jm0535/map-kit.git
cd map-kit

# Create a virtual environment
python -m venv .venv
source .venv/bin/activate

# Install with dev dependencies
pip install -e ".[dev]"

# Install pre-commit hooks
pre-commit install
```

## Code Quality

### Linting & Formatting

We use [Ruff](https://docs.astral.sh/ruff/) as the unified linter and formatter:

```bash
# Check for issues
ruff check .

# Auto-fix
ruff check --fix .

# Format
ruff format .
```

### Type Checking

We use [mypy](https://mypy.readthedocs.io/) for static type analysis:

```bash
mypy src/
```

### Pre-commit

Pre-commit hooks run automatically on `git commit`. To run manually:

```bash
pre-commit run --all-files
```

## Project Structure

```
map-kit/
├── index.html              # Web GIS frontend (standalone, zero-backend)
├── src/
│   ├── make_maps.py        # Legacy script (kept for backward compatibility)
│   └── map_kit/            # Python package
│       ├── __init__.py     # Package metadata
│       ├── cli.py          # CLI entry point (make-maps)
│       ├── data.py         # Study site data constants
│       └── maps.py         # Map generation functions
├── data/                   # Sample datasets
├── docs/                   # Generated output maps
├── pyproject.toml          # Project config, dependencies, tool settings
└── Makefile                # Common development tasks
```

## Making Changes

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes with type hints and docstrings
3. Run `make lint` and `make typecheck` to verify
4. Commit with a descriptive message
5. Push and open a Pull Request

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add new spatial analysis tool`
- `fix: correct Moran's I weight calculation`
- `docs: update README with CLI usage`
- `refactor: extract data constants to data.py`
- `chore: update ruff config`

## Web GIS (`index.html`)

The Web GIS is a single-file application. When modifying:

- All user-controlled data must be HTML-escaped before DOM insertion
- Use the existing overlay/modal pattern for dialogs (no `prompt()`/`alert()`)
- Maintain dark/light theme compatibility
- Test with at least one sample dataset from `data/`
