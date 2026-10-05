"""
Detector for the `no-naive-utc-datetime` convention.

Walks the Python AST of `src/` and `tests/` and reports every reference to
`datetime.utcnow`, `datetime.utcfromtimestamp` and `deprecated_utcnow`, called
or passed as a callable. The patterns are purely syntactic, so an AST walk gives
exact line numbers on every run; the scanner fingerprints findings by line, and
an LLM's drifting line numbers would churn issues between scans.

Uses only the standard library, because the scheduled workflow runs this with
the runner's system `python3` and no Sentry virtualenv.

Usage: python3 no-naive-utc-datetime.detect.py <repo-path>

Prints the scanner's ESLint-shaped JSON on stdout. Exits non-zero, with the
reason on stderr, if any file fails to parse or nothing was scanned, so a broken
run is never mistaken for a clean one.
"""

from __future__ import annotations

import ast
import json
import sys
from pathlib import Path

ROOTS = ("src", "tests")
RULE_ID = "no-naive-utc-datetime"

DEPRECATED_DATETIME_METHODS = {
    "utcnow": (
        "`datetime.utcnow()` is deprecated and returns a naive datetime. "
        "Use `django.utils.timezone.now()` or `datetime.now(UTC)`."
    ),
    "utcfromtimestamp": (
        "`datetime.utcfromtimestamp()` is deprecated and returns a naive datetime. "
        "Use `datetime.fromtimestamp(ts, UTC)`."
    ),
}
SHIM_NAME = "deprecated_utcnow"
SHIM_MESSAGE = (
    "`deprecated_utcnow()` only hides the `utcnow()` deprecation warning; it still "
    "returns a naive datetime. Use `django.utils.timezone.now()` or `datetime.now(UTC)`."
)


def is_datetime_class(node: ast.expr) -> bool:
    # `datetime.utcnow` (from datetime import datetime) and
    # `datetime.datetime.utcnow` (import datetime). Requiring the receiver to be
    # named `datetime` keeps unrelated attributes such as `self.utcnow` out.
    if isinstance(node, ast.Name):
        return node.id == "datetime"
    if isinstance(node, ast.Attribute):
        return node.attr == "datetime"
    return False


def find_violations(tree: ast.AST) -> list[dict[str, object]]:
    messages = []
    for node in ast.walk(tree):
        message = None
        if (
            isinstance(node, ast.Attribute)
            and node.attr in DEPRECATED_DATETIME_METHODS
            and is_datetime_class(node.value)
        ):
            message = DEPRECATED_DATETIME_METHODS[node.attr]
        elif (isinstance(node, ast.Name) and node.id == SHIM_NAME) or (
            isinstance(node, ast.Attribute) and node.attr == SHIM_NAME
        ):
            message = SHIM_MESSAGE

        if message is not None:
            messages.append(
                {
                    "ruleId": RULE_ID,
                    "message": message,
                    "line": node.lineno,
                    "endLine": node.end_lineno,
                    "column": node.col_offset + 1,
                }
            )
    return sorted(messages, key=lambda m: (m["line"], m["column"]))


def main() -> int:
    repo_path = Path(sys.argv[1]).resolve()
    results = []
    parse_errors = []
    scanned = 0

    for root in ROOTS:
        for path in sorted((repo_path / root).rglob("*.py")):
            scanned += 1
            source = path.read_text(encoding="utf-8")
            # Most files never mention these names; skipping them before
            # parsing keeps the run to a few seconds.
            if "utcnow" not in source and "utcfromtimestamp" not in source:
                continue
            try:
                tree = ast.parse(source, filename=str(path))
            except SyntaxError as e:
                parse_errors.append(f"{path}:{e.lineno}: {e.msg}")
                continue
            messages = find_violations(tree)
            if messages:
                results.append({"filePath": str(path), "messages": messages})

    if parse_errors:
        sys.stderr.write(
            f"failed to parse {len(parse_errors)} file(s) with Python "
            f"{sys.version.split()[0]}:\n" + "\n".join(parse_errors) + "\n"
        )
        return 1
    if scanned == 0:
        sys.stderr.write(f"no Python files found under {ROOTS} in {repo_path}\n")
        return 1

    found = sum(len(r["messages"]) for r in results)
    sys.stderr.write(f"scanned {scanned} files, {found} violations in {len(results)} files\n")
    json.dump(results, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
