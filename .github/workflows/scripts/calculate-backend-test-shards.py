#!/usr/bin/env python3
"""Calculate the number of backend test shards needed for CI.

Uses AST-based static analysis to count tests instead of running
pytest --collect-only, which requires importing every module and
bootstrapping Django (~100s). AST parsing takes a few seconds.
"""

from __future__ import annotations

import ast
import json
import math
import os
import re
import sys
from pathlib import Path

TESTS_PER_SHARD = 300
MIN_SHARDS = 1
MAX_SHARDS = 22
DEFAULT_SHARDS = MAX_SHARDS

IGNORED_DIRS = frozenset(("tests/acceptance/", "tests/apidocs/", "tests/js/", "tests/tools/"))


def _resolve(node: ast.expr, scope: dict[str, ast.expr]) -> ast.expr:
    """Chase Name and Subscript references back to a concrete AST node."""
    if isinstance(node, ast.Name) and node.id in scope:
        return _resolve(scope[node.id], scope)
    if (
        isinstance(node, ast.Subscript)
        and isinstance(node.value, ast.Name)
        and isinstance(node.slice, ast.Constant)
        and isinstance(node.slice.value, int)
        and node.value.id in scope
    ):
        target = _resolve(scope[node.value.id], scope)
        i = node.slice.value
        if isinstance(target, (ast.List, ast.Tuple)) and 0 <= i < len(target.elts):
            return _resolve(target.elts[i], scope)
    return node


def _parametrize_count(dec: ast.expr, scope: dict[str, ast.expr]) -> int | None:
    """If *dec* is a ``@pytest.mark.parametrize``, return the case count."""
    dec = _resolve(dec, scope)
    if not isinstance(dec, ast.Call) or len(dec.args) < 2:
        return None
    f = dec.func
    if not (
        isinstance(f, ast.Attribute)
        and f.attr == "parametrize"
        and isinstance(f.value, ast.Attribute)
        and f.value.attr == "mark"
        and isinstance(f.value.value, ast.Name)
        and f.value.value.id == "pytest"
    ):
        return None
    argvals = _resolve(dec.args[1], scope)
    return len(argvals.elts) if isinstance(argvals, (ast.List, ast.Tuple)) else None


_TEST_FUNC_RE = re.compile(r"^\s*(?:async\s+)?def\s+test_", re.MULTILINE)


def count_tests_in_file(filepath: Path) -> int:
    """Count the test items *filepath* would produce.

    Accounts for ``@pytest.mark.parametrize`` multipliers including
    stacked decorators.
    """
    try:
        source = filepath.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return 0

    # Fast path: no parametrize means each def test_ is exactly one test.
    if "parametrize" not in source:
        return len(_TEST_FUNC_RE.findall(source))

    try:
        tree = ast.parse(source, filename=str(filepath))
    except SyntaxError:
        return len(_TEST_FUNC_RE.findall(source))

    scope: dict[str, ast.expr] = {}
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    scope[target.id] = node.value
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.value:
            scope[node.target.id] = node.value

    total = 0
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith(
            "test_"
        ):
            counts = (
                c for d in node.decorator_list if (c := _parametrize_count(d, scope)) is not None
            )
            total += math.prod(counts, start=1)
    return total


def collect_test_count() -> int | None:
    """Count tests via AST analysis of test files."""
    selected_tests_file = os.environ.get("SELECTED_TESTS_FILE")

    if selected_tests_file:
        path = Path(selected_tests_file)
        if not path.exists():
            print(
                f"Selected tests file not found: {selected_tests_file}",
                file=sys.stderr,
            )
            return None

        test_files = [Path(line.strip()) for line in path.read_text().splitlines() if line.strip()]

        if not test_files:
            print("No selected test files, running 0 tests", file=sys.stderr)
            return 0

        print(f"Counting tests in {len(test_files)} selected files", file=sys.stderr)
    else:
        tests_dir = Path("tests")
        if not tests_dir.is_dir():
            print("tests/ directory not found", file=sys.stderr)
            return None

        test_files = sorted(
            p
            for p in tests_dir.rglob("test_*.py")
            if not any(str(p).startswith(d) for d in IGNORED_DIRS)
        )
        print(f"Found {len(test_files)} test files", file=sys.stderr)

    total = sum(count_tests_in_file(f) for f in test_files)
    print(f"Counted {total} tests via AST analysis", file=sys.stderr)
    return total


def calculate_shards(test_count: int | None) -> int:
    if test_count is None:
        print(f"Using default shard count: {DEFAULT_SHARDS}", file=sys.stderr)
        return DEFAULT_SHARDS

    if test_count == 0:
        print("No tests to run, skipping (0 shards)", file=sys.stderr)
        return 0

    if test_count > MAX_SHARDS * TESTS_PER_SHARD:
        print(
            f"Test count {test_count} exceeds {MAX_SHARDS * TESTS_PER_SHARD}, using max shards: {MAX_SHARDS}",
            file=sys.stderr,
        )
        return MAX_SHARDS

    calculated = math.ceil(test_count / TESTS_PER_SHARD)
    bounded = max(MIN_SHARDS, min(calculated, MAX_SHARDS))

    print(
        f"Calculated {bounded} shards ({test_count} tests ÷ {TESTS_PER_SHARD})",
        file=sys.stderr,
    )

    return bounded


def main() -> int:
    test_count = collect_test_count()
    shard_count = calculate_shards(test_count)
    shard_indices = json.dumps(list(range(shard_count)))

    github_output = os.getenv("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a") as f:
            f.write("\n")
            f.write(f"shard-count={shard_count}\n")
            f.write(f"shard-indices={shard_indices}\n")

    print(f"shard-count={shard_count}")
    print(f"shard-indices={shard_indices}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
