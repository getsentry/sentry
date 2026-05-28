"""Lint: assert decorator-T equals annotation-T for typed endpoint responses.

For each method decorated with
    @extend_schema(responses={N: inline_sentry_response_serializer("Name", T_decl)})
and annotated
    -> Response[T_annot]
this linter asserts that `T_decl == T_annot` (AST-level name equality) for the
2xx-status entry. mypy enforces body-vs-annotation; this linter enforces
decorator-vs-annotation. Together they close the schema/runtime drift gap.

Plain `-> Response` annotations are skipped (unmigrated endpoints). Decorator
entries that are canned constants (e.g. `RESPONSE_BAD_REQUEST`) are skipped.

Invoke as:
    python -m sentry.apidocs._check_response_annotation_matches_schema [paths...]

Exits non-zero on any mismatch.
"""

from __future__ import annotations

import ast
import sys
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path

DEFAULT_PATHS = (
    "src/sentry/api/endpoints",
    "src/sentry/replays/endpoints",
    "src/sentry/issues/endpoints",
    "src/sentry/discover/endpoints",
    "src/sentry/feedback/endpoints",
    "src/sentry/integrations",
    "src/sentry/monitors/endpoints",
    "src/sentry/preprod/api/endpoints",
    "src/sentry/releases/endpoints",
    "src/sentry/uptime/endpoints",
)

SUCCESS_STATUSES = frozenset(range(200, 300))


@dataclass(frozen=True)
class Mismatch:
    path: Path
    line: int
    cls: str
    method: str
    status: int
    decl: str
    annot: str

    def __str__(self) -> str:
        return (
            f"{self.path}:{self.line} {self.cls}.{self.method} status={self.status}: "
            f"decorator declares `{self.decl}`, annotation declares `{self.annot}`"
        )


def _name_of(node: ast.expr) -> str:
    """Render `Foo`, `mod.Foo`, `Foo[T]` as a stable string for equality."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return f"{_name_of(node.value)}.{node.attr}"
    if isinstance(node, ast.Subscript):
        return f"{_name_of(node.value)}[{_name_of(node.slice)}]"
    return ast.unparse(node)


def _extract_decorator_responses(
    decorator: ast.expr,
) -> dict[int, ast.expr]:
    """For `@extend_schema(responses={N: inline_sentry_response_serializer("X", T)})`,
    return {N: T_expr} for entries that use `inline_sentry_response_serializer`.
    Skips canned constants and non-2xx entries that don't carry a body schema.
    """
    if not isinstance(decorator, ast.Call):
        return {}
    func = decorator.func
    if not (isinstance(func, ast.Name) and func.id == "extend_schema"):
        if not (isinstance(func, ast.Attribute) and func.attr == "extend_schema"):
            return {}
    responses_kw = next((kw for kw in decorator.keywords if kw.arg == "responses"), None)
    if responses_kw is None or not isinstance(responses_kw.value, ast.Dict):
        return {}
    out: dict[int, ast.expr] = {}
    for key, val in zip(responses_kw.value.keys, responses_kw.value.values):
        if not isinstance(key, ast.Constant) or not isinstance(key.value, int):
            continue
        if key.value not in SUCCESS_STATUSES:
            continue
        if not isinstance(val, ast.Call):
            continue
        func_v = val.func
        is_inline = (
            isinstance(func_v, ast.Name) and func_v.id == "inline_sentry_response_serializer"
        ) or (
            isinstance(func_v, ast.Attribute) and func_v.attr == "inline_sentry_response_serializer"
        )
        if not is_inline or len(val.args) < 2:
            continue
        out[key.value] = val.args[1]
    return out


def _extract_response_annotation_T(returns: ast.expr | None) -> ast.expr | None:
    """If the return annotation is `Response[T]`, return the T expr. Else None
    (which means: skip this method — it's either unmigrated or non-Response).
    """
    if returns is None:
        return None
    if isinstance(returns, ast.Subscript):
        val = returns.value
        if isinstance(val, ast.Name) and val.id == "Response":
            return returns.slice
        if isinstance(val, ast.Attribute) and val.attr == "Response":
            return returns.slice
    return None


def _iter_methods(tree: ast.Module) -> Iterator[tuple[str, ast.FunctionDef | ast.AsyncFunctionDef]]:
    for node in tree.body:
        if not isinstance(node, ast.ClassDef):
            continue
        for item in node.body:
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                yield node.name, item


def check_file(path: Path) -> list[Mismatch]:
    try:
        source = path.read_text()
    except OSError:
        return []
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    mismatches: list[Mismatch] = []
    for cls_name, method in _iter_methods(tree):
        annot_T = _extract_response_annotation_T(method.returns)
        if annot_T is None:
            continue
        annot_name = _name_of(annot_T)

        decl_by_status: dict[int, ast.expr] = {}
        for dec in method.decorator_list:
            decl_by_status.update(_extract_decorator_responses(dec))

        if not decl_by_status:
            continue

        for status, decl_expr in decl_by_status.items():
            decl_name = _name_of(decl_expr)
            if decl_name != annot_name:
                mismatches.append(
                    Mismatch(
                        path=path,
                        line=method.lineno,
                        cls=cls_name,
                        method=method.name,
                        status=status,
                        decl=decl_name,
                        annot=annot_name,
                    )
                )
    return mismatches


def iter_files(roots: Iterable[str]) -> Iterator[Path]:
    for root in roots:
        rp = Path(root)
        if rp.is_file():
            if rp.suffix == ".py":
                yield rp
            continue
        yield from rp.rglob("*.py")


def main(argv: list[str]) -> int:
    roots = argv[1:] if len(argv) > 1 else list(DEFAULT_PATHS)
    all_mismatches: list[Mismatch] = []
    for path in iter_files(roots):
        all_mismatches.extend(check_file(path))
    for m in all_mismatches:
        sys.stdout.write(f"{m}\n")
    if all_mismatches:
        sys.stderr.write(
            f"\n{len(all_mismatches)} mismatch(es) — decorator's "
            "`inline_sentry_response_serializer(name, T)` must match the "
            "method's `-> Response[T]` annotation.\n",
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
