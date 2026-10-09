"""Estimate pytest test item counts without importing test modules."""

from __future__ import annotations

import ast
import math
import re
from pathlib import Path


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
