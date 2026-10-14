# Python typing in Sentry

This document describes how Sentry runs mypy, handles modules with typing debt, and writes annotations. The live configuration is in `pyproject.toml`.

## Run mypy

Run commands from the repository root.

```sh
uv run mypy
uv run mypy src/sentry/path/to/module.py
```

The first command checks the configured files. The second checks one module with the project configuration.

The mypy hook runs at pre-push when `SENTRY_MYPY_PRE_PUSH` is set. Run it on a specific file with:

```sh
SENTRY_MYPY_PRE_PUSH=1 .venv/bin/prek run -q mypy --files src/sentry/path/to/module.py --stage pre-push
```

The hook invokes `uv run mypy --no-warn-unused-configs` and checks the Python files passed by prek.

## Configuration

`pyproject.toml` configures mypy for Python 3.13, five workers, the project root, and Sentry's mypy plugins: Pydantic, Django stubs, and `tools.mypy_helpers.plugin`. It loads local stubs from `fixtures/stubs-for-mypy` and excludes virtual environments, `self-hosted/`, and `bin/`.

The global checks include:

- `check_untyped_defs`
- `no_implicit_reexport`
- `warn_unreachable`
- `warn_unused_configs`
- `warn_unused_ignores`
- `warn_redundant_casts`
- `disallow_any_generics`
- `disallow_untyped_defs`
- `strict_equality`

The config also enables the `ignore-without-code` and `redundant-self` error codes. It sets `local_partial_types` for compatibility with dmypy.

The config uses four override groups:

- **Third-party stubs:** `ignore_missing_imports` covers third-party modules without usable type information. Add local `.pyi` files under `fixtures/stubs-for-mypy` when maintaining stubs is appropriate.
- **Snuba SDK types:** `snuba_sdk.*` imports are skipped because the package's published types cause errors when mypy follows them.
- **Sentry typing errors:** the “sentry modules with typing issues” section disables selected error codes for listed modules. Fix these errors and remove the module from this section.
- **Modules not yet strongly typed:** the “not yet strongly typed” section disables `disallow_any_generics`, `disallow_untyped_defs`, and `strict_equality` for listed modules. Remove a module from this section when it passes these checks.

The weaklist hooks in `.pre-commit-config.yaml` sort and validate these lists and prevent new weaklist entries. The `check-mypy-bypass` hook rejects broad type-checker bypasses, including `# type: ignore`, `# mypy: ignore-errors`, and `no_type_check`.

## CI and generated typing errors

Backend CI runs `mypy` with `RuntimeWarning` treated as an error. After mypy succeeds, CI regenerates the “sentry modules with typing issues” section and fails if that changes the checked-in config. It also checks the generated mypy output for selected error patterns that must not regress.

Regenerate the error section locally with:

```sh
uv run python -m tools.mypy_helpers.make_module_ignores
```

The helper runs mypy with the Sentry typing-issues override removed. It clears `.mypy_cache`, writes the raw output to `.artifacts/mypy-all`, and rewrites the generated section in `pyproject.toml`.

To rank files by their current error count, run:

```sh
uv run python -m tools.mypy_helpers.find_easiest_modules
```

This helper also runs mypy with the Sentry typing-issues override removed, then prints error counts by file.

## Type a module

When adopting a module, annotate the whole module rather than adding isolated hints. Add parameter and return annotations to every function, then remove the module from the “not yet strongly typed” list after it passes the global checks.

Type new code even when its module still contains untyped legacy code. Once a module is strongly typed, keep new functions typed so the module does not regress.

Keep annotation work in proportion to the behavior change. Do not bury a two-line functional change under hundreds of lines of unrelated typing cleanup. Do not add hundreds of lines of new code without annotations. A change should not increase the total number of mypy errors.

When prioritizing cleanup, type application code before test helpers. Mocks, patches, and other test doubles can require more work to model. Keep tests subject to the repository's configured mypy checks.

## Annotation patterns

- Use specific types. Define a named type or generic when a signature becomes hard to read.
- Use `Mapping` and `Sequence` for inputs when the function reads but does not mutate them. These interfaces accept more valid inputs than `dict` and `list`, including tuples where a sequence is sufficient. Use `MutableMapping` or `MutableSequence` when mutation is part of the function's contract.
- Prefer specific types over `Any`. Avoid type ignores. The `check-mypy-bypass` hook rejects `# type: ignore`; use a local stub for an untyped dependency when practical.
- Use `from __future__ import annotations` for forward references when needed.
- Use `TYPE_CHECKING` for imports needed only to evaluate annotations. This avoids runtime import cycles caused by type-only dependencies.
- `TypedDict` does not support `isinstance`. For runtime discrimination, use a `Literal` tag and explicit checks, or use a dataclass or `NamedTuple` that supports `isinstance`.

For a method that returns an instance of its class, deferred annotations let you name the class without quoting it:

```python
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Record:
    value: int

    def copy(self) -> Record:
        return Record(self.value)
```

Use `TYPE_CHECKING` to break import cycles caused only by type annotations:

```python
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentry.models.organization import Organization


def process(organization: Organization) -> None:
    ...
```

Mypy also catches contradictions in annotations. For example, it reports an error and marks the branch unreachable when code tests a `set[int]` value as a `str`:

```python
project_ids: set[int] = set()
if isinstance(project_ids, str):
    project_ids = set()
```

## Editor support

Mypy integrations can show type errors inline in an editor. Configure them to use the Sentry environment and `pyproject.toml`. Use the repository's mypy command to confirm errors because other language servers may not use Sentry's mypy plugins.

For annotation syntax and common checker issues, see the [mypy cheat sheet](https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html), [mypy generics guide](https://mypy.readthedocs.io/en/stable/generics.html), and [mypy common issues](https://mypy.readthedocs.io/en/stable/common_issues.html).
