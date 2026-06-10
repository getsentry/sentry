"""Lint: enforce typed response annotations on PUBLIC endpoints.

This module runs two checks against every HTTP method in an endpoint class.

## Check 1 — decorator `T` ⊆ annotation `T`s (drift)

For each method decorated with
    @extend_schema(responses={N: inline_sentry_response_serializer("Name", T_decl), ...})
and annotated
    -> Response[T_annot]
or, when the endpoint exposes multiple typed response shapes,
    -> Response[T_success] | Response[T_error_400] | ...

this linter asserts that the *set* of `T`s declared by
`inline_sentry_response_serializer(...)` entries in the decorator is a subset of
the `T`s in the annotation's union arms. Names are compared verbatim — no
normalization, no convention-based pairing. mypy enforces body-vs-annotation;
this linter enforces decorator-vs-annotation.

The status-code-to-`T` linkage is intentionally not enforced — mypy can't model
it, and broad `except APIException` catches would lose the linkage anyway.

Skipped silently (no diagnostic):
  - Plain `-> Response` annotations (handled by Check 2 for PUBLIC).
  - Methods with no `@extend_schema` decorator.
  - Decorator entries that aren't `inline_sentry_response_serializer(...)` —
    direct serializer-class references (`MonitorSerializer`),
    `OpenApiResponse(...)` wrappers, `RESPONSE_*` canned constants, `None`,
    raw `dict`, etc. These don't carry a statically-resolvable `T` for the
    linter to compare; either migrate them to
    `inline_sentry_response_serializer(...)` or wait for the generic
    `Serializer[T]` refactor.

## Check 2 — PUBLIC endpoints must have typed return annotations

For each HTTP method on an endpoint class whose `publish_status` declares the
method as `ApiPublishStatus.PUBLIC`, the return annotation must be one of:
  - `Response[T]` for a concrete TypedDict / type `T`
  - a `|`-union of `Response[T_i]` arms (and optionally non-`Response` arms
    for endpoints that legitimately return Django responses, e.g.
    `Response[Foo] | StreamingHttpResponse`)
  - a non-`Response` Django response type if the endpoint never returns a
    DRF `Response` (e.g. `HttpResponseBase`, `StreamingHttpResponse`,
    `FileResponse`)

The following are diagnostics:
  - **missing annotation** — PUBLIC methods must explicitly declare what
    they return so mypy can verify the body and drf-spectacular can
    document it.
  - **bare `Response`** — `-> Response` without `[T]` opts the method out of
    type checking entirely. PUBLIC endpoints are documented in OpenAPI; an
    untyped body lets the runtime drift from the declared schema.

Invoke as:
    python -m sentry.apidocs._check_response_annotation_matches_schema [paths...]

Exits non-zero on any diagnostic.
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


_HTTP_METHODS = frozenset({"get", "post", "put", "patch", "delete", "head", "options"})

_PUBLIC_HOW_TO = (
    "Fix by replacing the annotation with one of:\n"
    "  -> Response[YourResponseTypedDict]              # single 200 shape\n"
    "  -> Response[YourResponseTypedDict] | Response[DetailResponse]\n"
    "                                                  # success + error shape\n"
    "  -> Response[None]                                # explicit empty body\n"
    "  -> HttpResponseBase                              # streaming/redirect/non-DRF\n"
    "If the body shape isn't documented anywhere yet, define a local\n"
    "TypedDict in the endpoint file (`class _FooResponse(TypedDict): ...`)\n"
    "and reference it. Standard error shapes (`{'detail': str}`,\n"
    "`{field: errors}`) live in `sentry.apidocs.response_types`."
)


@dataclass(frozen=True)
class Mismatch:
    path: Path
    line: int
    cls: str
    method: str
    decl: frozenset[str]
    annot: frozenset[str]

    def __str__(self) -> str:
        decl = ", ".join(sorted(self.decl)) or "<none>"
        annot = ", ".join(sorted(self.annot)) or "<none>"
        missing = ", ".join(sorted(self.decl - self.annot))
        return (
            f"{self.path}:{self.line} {self.cls}.{self.method}: "
            f"decorator declares {{{decl}}} but annotation declares {{{annot}}} "
            f"(missing from annotation: {{{missing}}})"
        )


@dataclass(frozen=True)
class PublicUntyped:
    """A PUBLIC HTTP method that lacks a usable return annotation."""

    path: Path
    line: int
    cls: str
    method: str
    reason: str  # "missing" or "bare-Response"

    def __str__(self) -> str:
        if self.reason == "missing":
            problem = "is PUBLIC but has no return annotation"
        else:
            problem = "is PUBLIC but annotated with bare `Response` (no `[T]`)"
        return (
            f"{self.path}:{self.line} {self.cls}.{self.method}: {problem}.\n"
            "Why: PUBLIC endpoints are documented in the OpenAPI spec and\n"
            "consumed by SDK generators and external clients. An untyped\n"
            "return lets the runtime body drift from the declared schema\n"
            "without anyone noticing (mypy can't verify what isn't typed).\n"
            f"{_PUBLIC_HOW_TO}"
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


def _is_response_subscript(node: ast.expr) -> ast.expr | None:
    """If `node` is `Response[T]` (or `rest_framework.response.Response[T]`),
    return the `T` expression. Otherwise return None."""
    if not isinstance(node, ast.Subscript):
        return None
    val = node.value
    if isinstance(val, ast.Name) and val.id == "Response":
        return node.slice
    if isinstance(val, ast.Attribute) and val.attr == "Response":
        return node.slice
    return None


def _extract_decorator_response_Ts(decorator: ast.expr) -> list[ast.expr]:
    """From `@extend_schema(responses={N: inline_sentry_response_serializer("X", T), ...})`,
    return every `T` expression. Only this explicit form is recognized — it's the
    one shape where the linter has a real handle on what the typed schema is.

    Skipped silently (no extractable T):
      - Direct serializer-class references (e.g. `MonitorSerializer`). These
        carry a typed output by sentry convention but no statically-resolvable
        link to a TypedDict. Either migrate the entry to
        `inline_sentry_response_serializer(...)`, or wait for the generic-
        `Serializer[T]` refactor to land — both give the linter a real handle.
      - Canned `RESPONSE_*` constants (no T — error responses, untyped body).
      - `OpenApiResponse(...)` wrappers.
      - `None`, raw `dict`, etc.

    Status code is intentionally ignored — see module docstring.
    """
    if not isinstance(decorator, ast.Call):
        return []
    func = decorator.func
    if not (
        (isinstance(func, ast.Name) and func.id == "extend_schema")
        or (isinstance(func, ast.Attribute) and func.attr == "extend_schema")
    ):
        return []
    responses_kw = next((kw for kw in decorator.keywords if kw.arg == "responses"), None)
    if responses_kw is None or not isinstance(responses_kw.value, ast.Dict):
        return []
    out: list[ast.expr] = []
    for key, val in zip(responses_kw.value.keys, responses_kw.value.values):
        if not isinstance(key, ast.Constant) or not isinstance(key.value, int):
            continue
        if not isinstance(val, ast.Call):
            continue
        func_v = val.func
        is_inline = (
            isinstance(func_v, ast.Name) and func_v.id == "inline_sentry_response_serializer"
        ) or (
            isinstance(func_v, ast.Attribute) and func_v.attr == "inline_sentry_response_serializer"
        )
        if is_inline and len(val.args) >= 2:
            out.append(val.args[1])
    return out


def _extract_response_annotation_Ts(returns: ast.expr | None) -> list[ast.expr] | None:
    """Parse the return annotation and return the list of `T` expressions that appear
    inside `Response[...]` (handling both single `Response[T]` and union
    `Response[T_a] | Response[T_b]` forms).

    Returns:
      - `None` if the annotation is not a `Response[T]` (or union thereof) — that's
        the unmigrated state; the method is skipped.
      - A non-empty list of `T` AST expressions otherwise.
    """
    if returns is None:
        return None

    # Collect every leaf of a union, then check each is `Response[T]`.
    arms: list[ast.expr] = []
    pending: list[ast.expr] = [returns]
    while pending:
        node = pending.pop()
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
            pending.append(node.left)
            pending.append(node.right)
        else:
            arms.append(node)

    extracted: list[ast.expr] = []
    for arm in arms:
        T = _is_response_subscript(arm)
        if T is None:
            # If any arm is `Response` (bare, unparameterized) or some other type,
            # we can't meaningfully compare — treat this as unmigrated.
            return None
        extracted.append(T)
    return extracted or None


def _iter_methods(tree: ast.Module) -> Iterator[tuple[str, ast.FunctionDef | ast.AsyncFunctionDef]]:
    for node in tree.body:
        if not isinstance(node, ast.ClassDef):
            continue
        for item in node.body:
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                yield node.name, item


def _iter_classes(tree: ast.Module) -> Iterator[ast.ClassDef]:
    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            yield node


def _publish_status(cls: ast.ClassDef) -> dict[str, str]:
    """Return `{HTTP_METHOD: ApiPublishStatus_attr_name}` parsed from
    `publish_status = {"GET": ApiPublishStatus.PUBLIC, ...}` on the class
    body. Also handles the annotated form
    `publish_status: dict[str, ApiPublishStatus] = {...}`. Returns `{}`
    when the class has no such assignment or the value doesn't statically
    match the expected literal-dict shape."""
    for item in cls.body:
        value: ast.expr | None = None
        if (
            isinstance(item, ast.Assign)
            and len(item.targets) == 1
            and isinstance(item.targets[0], ast.Name)
            and item.targets[0].id == "publish_status"
        ):
            value = item.value
        elif (
            isinstance(item, ast.AnnAssign)
            and isinstance(item.target, ast.Name)
            and item.target.id == "publish_status"
            and item.value is not None
        ):
            value = item.value
        if not isinstance(value, ast.Dict):
            continue
        out: dict[str, str] = {}
        for k, v in zip(value.keys, value.values):
            if (
                isinstance(k, ast.Constant)
                and isinstance(k.value, str)
                and isinstance(v, ast.Attribute)
            ):
                out[k.value] = v.attr
        return out
    return {}


def _is_union_subscript(node: ast.expr) -> ast.expr | None:
    """If `node` is `Union[a, b, ...]` or `typing.Union[a, b, ...]`, return the
    slice expression (a `Tuple` of arms, or a single arm for the degenerate
    `Union[X]`). Otherwise return None."""
    if not isinstance(node, ast.Subscript):
        return None
    val = node.value
    if (isinstance(val, ast.Name) and val.id == "Union") or (
        isinstance(val, ast.Attribute) and val.attr == "Union"
    ):
        return node.slice
    return None


def _annotation_has_bare_response(returns: ast.expr) -> bool:
    """Walk a return annotation's union arms; return True iff any arm is the
    bare `Response` name (no `[T]` subscript). Handles both `X | Y` and
    `Union[X, Y]` union forms."""
    pending: list[ast.expr] = [returns]
    while pending:
        node = pending.pop()
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
            pending.append(node.left)
            pending.append(node.right)
            continue
        union_slice = _is_union_subscript(node)
        if union_slice is not None:
            if isinstance(union_slice, ast.Tuple):
                pending.extend(union_slice.elts)
            else:
                pending.append(union_slice)
            continue
        if isinstance(node, ast.Name) and node.id == "Response":
            return True
        if isinstance(node, ast.Attribute) and node.attr == "Response":
            # `rest_framework.response.Response` — bare attribute form
            return True
    return False


def check_file_public_typed(path: Path) -> list[PublicUntyped]:
    """Diagnose PUBLIC methods that lack a usable return annotation."""
    try:
        source = path.read_text()
    except OSError:
        return []
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    out: list[PublicUntyped] = []
    for cls in _iter_classes(tree):
        ps = _publish_status(cls)
        if not ps:
            continue
        for item in cls.body:
            if not isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if item.name not in _HTTP_METHODS:
                continue
            if ps.get(item.name.upper()) != "PUBLIC":
                continue
            if item.returns is None:
                out.append(
                    PublicUntyped(
                        path=path,
                        line=item.lineno,
                        cls=cls.name,
                        method=item.name,
                        reason="missing",
                    )
                )
                continue
            if _annotation_has_bare_response(item.returns):
                out.append(
                    PublicUntyped(
                        path=path,
                        line=item.lineno,
                        cls=cls.name,
                        method=item.name,
                        reason="bare-Response",
                    )
                )
    return out


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
        annot_Ts = _extract_response_annotation_Ts(method.returns)
        if annot_Ts is None:
            continue

        decl_Ts: list[ast.expr] = []
        for dec in method.decorator_list:
            decl_Ts.extend(_extract_decorator_response_Ts(dec))

        if not decl_Ts:
            continue

        decl_set = frozenset(_name_of(t) for t in decl_Ts)
        annot_set = frozenset(_name_of(t) for t in annot_Ts)
        # Subset semantics, not strict equality: every typed T declared by
        # `inline_sentry_response_serializer` in the decorator MUST appear in
        # the annotation (drift caught), but the annotation MAY declare extra
        # arms not in the decorator (e.g. local error TypedDicts not exposed
        # in OpenAPI via opaque `RESPONSE_*` constants). This preserves
        # API-as-today: endpoints that keep `RESPONSE_BAD_REQUEST`-style
        # opaque error declarations can still enrich their internal
        # annotations without changing the OpenAPI document.
        if not decl_set.issubset(annot_set):
            mismatches.append(
                Mismatch(
                    path=path,
                    line=method.lineno,
                    cls=cls_name,
                    method=method.name,
                    decl=decl_set,
                    annot=annot_set,
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
    all_untyped: list[PublicUntyped] = []
    for path in iter_files(roots):
        all_mismatches.extend(check_file(path))
        all_untyped.extend(check_file_public_typed(path))

    for m in all_mismatches:
        sys.stdout.write(f"{m}\n")
    for u in all_untyped:
        sys.stdout.write(f"{u}\n")

    if all_mismatches:
        sys.stderr.write(
            f"\n{len(all_mismatches)} decorator/annotation mismatch(es) — every "
            "`T` declared by `inline_sentry_response_serializer(...)` in "
            "`@extend_schema` must appear in the `Response[T]` (or union) "
            "annotation. The annotation MAY declare additional arms (e.g. "
            "local error TypedDicts) that the decorator does not expose.\n",
        )
    if all_untyped:
        sys.stderr.write(
            f"\n{len(all_untyped)} PUBLIC method(s) without a typed return "
            "annotation. PUBLIC endpoints are documented in OpenAPI and must "
            "declare the runtime response shape statically so mypy + the "
            "OpenAPI generator can keep the spec honest.\n"
        )
    if all_mismatches or all_untyped:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
