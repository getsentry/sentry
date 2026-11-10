"""
Ratchet that keeps every field in the public API's success responses described and typed.

`make build-api-docs` writes `tests/apidocs/openapi-spectacular.json`. There, each TypedDict
field carries its Python source in `FIELD_SOURCE`, a recursive TypedDict cut short
carries `CYCLE`, and a `JsonValue` field carries `JSON_VALUE`; the deref step strips all
three from the published schema.
`tests/apidocs/test_response_coverage.py` compares what `find_violations` reports with the
committed baseline. See "Response fields" in `src/sentry/apidocs/README.md`.

Prune fixed entries from the baseline with:

    python -m sentry.apidocs.response_coverage --prune
"""

from __future__ import annotations

import argparse
import json  # noqa: S003
import sys
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any

FIELD_SOURCE = "x-sentry-source"
CYCLE = "x-sentry-cycle"
JSON_VALUE = "x-sentry-json-value"

MISSING_DESCRIPTION = "missing-description"
UNTYPED = "untyped"

REPO_ROOT = Path(__file__).resolve().parents[3]
SPEC_PATH = REPO_ROOT / "tests" / "apidocs" / "openapi-spectacular.json"
BASELINE_PATH = REPO_ROOT / "tests" / "apidocs" / "response-coverage-baseline.txt"
DOCS = "src/sentry/apidocs/README.md#response-fields"

_REF_PREFIX = "#/components/schemas/"
_COMBINATORS = ("oneOf", "anyOf", "allOf")


def _ref_name(schema: Mapping[str, Any]) -> str | None:
    ref = schema.get("$ref")
    if isinstance(ref, str) and ref.startswith(_REF_PREFIX):
        return ref[len(_REF_PREFIX) :]
    return None


def _unwrap(schema: Mapping[str, Any]) -> Mapping[str, Any]:
    """drf-spectacular wraps a described or nullable reference in a one-item `allOf`."""
    all_of = schema.get("allOf")
    if isinstance(all_of, list) and len(all_of) == 1 and _ref_name(all_of[0]):
        return all_of[0]
    return schema


def _has_text(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _is_untyped(schema: Mapping[str, Any]) -> bool:
    """`Any` (`{}`), `dict[str, Any]`, and an object without properties are untyped.

    A recursive TypedDict leaves its fields out where it repeats, so that object is typed.
    So is an object with `maxProperties: 0`, which a TypedDict without fields produces:
    it can only be `{}`. A `JsonValue` is typed too: it is any JSON value on purpose.
    """
    schema = _unwrap(schema)
    if (
        schema.get(CYCLE)
        or schema.get(JSON_VALUE)
        or _ref_name(schema)
        or "enum" in schema
        or any(k in schema for k in _COMBINATORS)
    ):
        return False
    kind = schema.get("type")
    if kind is None:
        return True
    if kind == "object":
        if schema.get("maxProperties") == 0:
            return False
        values = schema.get("additionalProperties")
        return not schema.get("properties") and not (isinstance(values, dict) and values)
    return False


class _Walker:
    def __init__(self, spec: Mapping[str, Any]) -> None:
        self.spec = spec
        self.components: Mapping[str, Any] = spec.get("components", {}).get("schemas", {})
        self.violations: set[str] = set()
        self._pending: list[str] = []
        self._seen: set[str] = set()

    def _described(self, prop: Mapping[str, Any]) -> bool:
        if _has_text(prop.get("description")):
            return True
        # A pure reference is replaced by its component, description included, on deref.
        name = _ref_name(_unwrap(prop))
        return name is not None and _has_text(self.components.get(name, {}).get("description"))

    def _node(self, schema: Mapping[str, Any], key: str) -> None:
        if _is_untyped(schema):
            self.violations.add(f"{UNTYPED} {key}")
        schema = _unwrap(schema)
        if schema.get(JSON_VALUE):
            # Its branches accept any object or array, which isn't a missing type.
            return
        name = _ref_name(schema)
        if name is not None:
            if name not in self._seen:
                self._seen.add(name)
                self._pending.append(name)
            return
        for combinator in _COMBINATORS:
            for index, branch in enumerate(schema.get(combinator, ())):
                self._node(branch, f"{key}<{combinator}{index}>")
        items = schema.get("items")
        if isinstance(items, dict):
            self._node(items, f"{key}[]")
        values = schema.get("additionalProperties")
        if isinstance(values, dict) and values:
            self._node(values, f"{key}{{}}")
        for field, prop in (schema.get("properties") or {}).items():
            # A TypedDict field is keyed by its source, so reusing the TypedDict elsewhere
            # doesn't add entries; other fields are keyed by their path from the root.
            field_key = prop.get(FIELD_SOURCE) or f"{key}.{field}"
            if not self._described(prop):
                self.violations.add(f"{MISSING_DESCRIPTION} {field_key}")
            self._node(prop, field_key)

    def walk(self) -> set[str]:
        for path, operations in self.spec.get("paths", {}).items():
            for method, operation in operations.items():
                if not isinstance(operation, dict):
                    continue
                for status, response in operation.get("responses", {}).items():
                    if not str(status).startswith("2"):
                        continue
                    content = response.get("content") or {}
                    schema = content.get("application/json", {}).get("schema")
                    if schema is not None:
                        self._node(schema, f"{method.upper()} {path} {status}")
        while self._pending:
            name = self._pending.pop()
            self._node(self.components[name], f"components/{name}")
        return self.violations


def find_violations(spec: Mapping[str, Any]) -> set[str]:
    """Each violation is `<kind> <key>`; the key names a TypedDict field or a schema path."""
    return _Walker(spec).walk()


def has_field_sources(spec: Mapping[str, Any]) -> bool:
    return f'"{FIELD_SOURCE}"' in json.dumps(spec)


def load_baseline() -> set[str]:
    lines = (line.strip() for line in BASELINE_PATH.read_text().splitlines())
    return {line for line in lines if line and not line.startswith("#")}


def write_baseline(entries: Iterable[str]) -> None:
    header = (
        f"# Response fields that are not described or typed yet; see {DOCS}.\n"
        "# Only remove lines: python -m sentry.apidocs.response_coverage --prune\n"
    )
    BASELINE_PATH.write_text(header + "".join(f"{entry}\n" for entry in sorted(entries)))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0].strip())
    parser.add_argument("--prune", action="store_true", help="remove fixed baseline entries")
    args = parser.parse_args(argv)

    spec = json.loads(SPEC_PATH.read_text())
    if not has_field_sources(spec):
        parser.error(f"{SPEC_PATH} has no field sources; rebuild it with `make build-api-docs`")
    violations = find_violations(spec)
    baseline = load_baseline()
    fixed = baseline - violations
    new = violations - baseline
    if args.prune and fixed:
        write_baseline(baseline - fixed)
    sys.stdout.write(f"{len(fixed)} fixed{' and pruned' if args.prune else ''}, {len(new)} new\n")
    sys.stdout.writelines(f"new: {entry}\n" for entry in sorted(new))
    return 1 if new else 0


if __name__ == "__main__":
    raise SystemExit(main())
