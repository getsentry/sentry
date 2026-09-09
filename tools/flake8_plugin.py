from __future__ import annotations

import ast
import os
from collections.abc import Generator
from datetime import datetime, timezone
from typing import Any

S001_fmt = (
    "S001 Avoid using the {} mock call as it is "
    "confusing and prone to causing invalid test "
    "behavior."
)
S001_methods = frozenset(("not_called", "called_once", "called_once_with"))

S002_msg = "S002 print functions or statements are not allowed."

S003_msg = "S003 Use `from sentry.utils import json` instead."
S003_modules = frozenset(("json", "simplejson"))

S004_msg = "S004 Use `pytest.raises` instead for better debuggability."
S004_methods = frozenset(("assertRaises", "assertRaisesRegex"))

S005_msg = "S005 Do not import models from sentry.models but the actual module"

S006_msg = "S006 Do not use force_bytes / force_str -- test the types directly"

S007_msg = "S007 Do not import sentry.testutils into production code."

S008_msg = "S008 Use datetime.fromisoformat rather than guessing at date formats"

S009_msg = "S009 Use `raise` with no arguments to reraise exceptions"

S010_msg = "S010 Except handler does nothing and should be removed"

S011_msg = "S011 Use override_options(...) instead to ensure proper cleanup"

# SentryIsAuthenticated extends from IsAuthenticated and provides additional checks for demo users
S012_msg = "S012 Use `from sentry.api.permissions import SentryIsAuthenticated` instead"

S013_msg = "S013 Use `django.contrib.postgres.fields.array.ArrayField` instead"

S014_msg = "S014 Use `unittest.mock` instead"

S016_msg = "S016 Use `from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor` instead of `concurrent.futures.ThreadPoolExecutor` to ensure contextvars propagation."

S017_msg = (
    "S017 Platform boundary violation: do not import non-platform getsentry code in "
    "billing/platform/. Use only getsentry.billing.platform.* imports."
)

S018_msg = (
    "S018 Use `sentry.cache.backends.reconnectingmemcache.ReconnectingMemcache` "
    "instead of `django.core.cache.backends.memcached.PyMemcacheCache`."
)
S018_fqn = "django.core.cache.backends.memcached.PyMemcacheCache"  # noqa: S018
S018_module = "django.core.cache.backends.memcached"

S019_fmt = (
    "S019 {!r} is a reserved LogRecord attribute; using it as a key in "
    "logging extra= raises KeyError at runtime"
)
S019_logging_methods = frozenset(
    ("debug", "info", "warning", "warn", "error", "exception", "critical", "fatal", "log")
)
# Keys rejected by logging.Logger.makeRecord: the attributes set in
# LogRecord.__init__ plus the explicit "message"/"asctime" guard.
S019_logrecord_attrs = frozenset(
    (
        "name",
        "msg",
        "args",
        "levelname",
        "levelno",
        "pathname",
        "filename",
        "module",
        "exc_info",
        "exc_text",
        "stack_info",
        "lineno",
        "funcName",
        "created",
        "msecs",
        "relativeCreated",
        "thread",
        "threadName",
        "processName",
        "process",
        "taskName",
        "message",
        "asctime",
    )
)

# Snuba EAP standard retention defaults to 30d and routes older starts to tier 8.
# OrganizationEventsEndpointTestBase injects statsPeriod via client_get/do_request.
S020_msg = (
    "S020 Use client_get()/do_request() instead of self.client.get() in "
    "OrganizationEventsEndpointTestBase suites so default statsPeriod is applied"
)
S020_eap_base_classes = frozenset(
    (
        "OrganizationEventsEndpointTestBase",
        # Transitive base used by trace/meta suites; still inherits the helper.
        "OrganizationEventsTraceEndpointBase",
    )
)


# --- S015: do not hardcode current or future UTC year as test "now" ---
# Flag year >= current UTC year at lint time. Module/class scope + freeze_time(datetime(...)).
S021_msg = (
    "S021 Every T declared by inline_sentry_response_serializer(...) in "
    "@extend_schema must appear in the Response[T] return annotation. "
    "Missing from the annotation: {}."
)
S022_missing_msg = (
    "S022 PUBLIC endpoint methods must declare their response shape. This "
    "method has no return annotation; use Response[YourTypedDict], a union of "
    "Response[T] arms, Response[None], or a non-DRF response type."
)
S022_bare_msg = (
    "S022 PUBLIC endpoint methods must declare their response shape. Bare "
    "`Response` opts the body out of type checking; use Response[YourTypedDict], "
    "a union of Response[T] arms, or Response[None]."
)
S023_no_reason_msg = (
    "S023 exclude_fields={!r} has no recorded reason. Add a help_text to the "
    "field, or withhold it deliberately with @sentry_schema_serializer("
    'omit_from_public_schema={{{!r}: "<why>"}}).'
)
S023_not_mapping_msg = "S023 omit_from_public_schema must be a {field: reason} mapping."
S023_blank_reason_msg = (
    "S023 omit_from_public_schema[{!r}] needs a reason explaining why the field "
    "is not public surface."
)
S023_ghost_msg = (
    "S023 {}={!r} names no field on this class; it omits nothing and should be deleted."
)

S024_msg = (
    "S024 This module discovers .py files and parses them with ast, which is a "
    "linter built outside the two supported mechanisms. Single-file checks belong "
    "in tools/flake8_plugin.py as an S rule; checks that must resolve a name from "
    "another module belong in tools/mypy_helpers/plugin.py."
)
S024_stale_msg = (
    "S024 stale safelist entry: this module no longer discovers and parses .py "
    "files. Remove it from S024_safelist."
)
# Repo-relative paths that parse source for reasons other than linting. Shrinks
# only; setup.cfg already ignores S codes under tools/, so those are redundant.
S024_safelist = frozenset(("tools/migrations/squash.py",))

_S024_discovery_methods = frozenset(("rglob", "glob", "iglob"))


# Rules whose diagnostics are fatal. Empty ships every rule off; adding one
# gates every endpoint of that shape at once, with no baseline to maintain.
ENFORCED: frozenset[str] = frozenset()

# Emit regardless of ENFORCED, so a plain flake8 run is the backlog inventory.
INPUT_LINT_ALL_ENV = "SENTRY_INPUT_LINT_ALL"

S025_query_msg = (
    "S025 {} validates the query string but is not declared in "
    "@extend_schema(parameters=...), so the schema does not document what this "
    "endpoint accepts. Add it to parameters=."
)
S026_msg = (
    "S026 {} is read straight off the {}, so the schema has nothing to document and "
    "the value is an unchecked string. Read it through a serializer declared in "
    "@extend_schema."
)
S027_msg = (
    "S027 the {} is read with the computed key {}, so no schema can document it. "
    "Read a literal key, or declare this endpoint's input as an exception."
)
S028_msg = (
    "S028 the whole {} is handed to {}, so what this endpoint accepts cannot be "
    "determined. Read the values here, or declare this endpoint's input as an exception."
)
S025_body_msg = (
    "S025 {} validates the request body but is not declared in "
    "@extend_schema(request=...), so the schema does not document what this "
    "endpoint accepts. Add it as request=."
)


def _s015_msg() -> str:
    return (
        "S015 Do not hardcode datetime with current or future UTC year at module/class "
        "scope or in freeze_time(...); use before_now(...), now-timedelta, or an older fixed year"
    )


def _is_tests_path(filename: str) -> bool:
    return "tests/" in filename or "testutils/" in filename


def _is_platform_path(filename: str) -> bool:
    return "billing/platform/" in filename and "tests/" not in filename


def _is_non_platform_import(module: str) -> bool:
    """Check if a getsentry import is outside the billing platform."""
    if module.startswith("getsentry.") or module == "getsentry":
        platform_prefix = "getsentry.billing.platform"
        if not (module.startswith(platform_prefix + ".") or module == platform_prefix):
            return True
    return False


# Returns the literal year when this is a datetime(...) call shape we lint for.
def _wall_clock_year_from_datetime_call(node: ast.Call) -> int | None:
    if not node.args:
        return None
    y = node.args[0]
    if not isinstance(y, ast.Constant) or not isinstance(y.value, int):
        return None
    if isinstance(node.func, ast.Name) and node.func.id == "datetime":
        return y.value
    if (
        isinstance(node.func, ast.Attribute)
        and node.func.attr == "datetime"
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "datetime"
    ):
        return y.value
    return None


def _is_eap_events_endpoint_test_path(filename: str) -> bool:
    # Keep S020 scoped to snuba organization-events endpoint suites.
    return "tests/snuba/api/endpoints/" in filename and "test_organization_" in filename


def _base_class_names(node: ast.ClassDef) -> list[str]:
    names: list[str] = []
    for base in node.bases:
        if isinstance(base, ast.Name):
            names.append(base.id)
        elif isinstance(base, ast.Attribute):
            names.append(base.attr)
    return names


def _collect_eap_suite_class_names(tree: ast.AST) -> set[str]:
    """Classes in this module that inherit an EAP events endpoint test base."""
    class_bases: dict[str, list[str]] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            class_bases[node.name] = _base_class_names(node)

    eap_classes = set(S020_eap_base_classes)
    changed = True
    while changed:
        changed = False
        for name, bases in class_bases.items():
            if name in eap_classes:
                continue
            if any(base in eap_classes for base in bases):
                eap_classes.add(name)
                changed = True
    return eap_classes


HTTP_METHODS = frozenset({"get", "post", "put", "patch", "delete", "head", "options"})


def publish_status(cls: ast.ClassDef) -> dict[str, str]:
    """`{HTTP_METHOD: ApiPublishStatus_attr}` from a class's `publish_status`.

    Handles plain and annotated assignment; `{}` when absent or not a literal dict."""
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
        return {
            k.value: v.attr
            for k, v in zip(value.keys, value.values)
            if isinstance(k, ast.Constant)
            and isinstance(k.value, str)
            and isinstance(v, ast.Attribute)
        }
    return {}


def is_extend_schema(decorator: ast.expr) -> bool:
    if not isinstance(decorator, ast.Call):
        return False
    func = decorator.func
    return (isinstance(func, ast.Name) and func.id == "extend_schema") or (
        isinstance(func, ast.Attribute) and func.attr == "extend_schema"
    )


def extend_schema_kwarg(decorators: list[ast.expr], name: str) -> Generator[ast.expr]:
    """Value of keyword `name` from every `@extend_schema` in `decorators`."""
    for dec in decorators:
        if not is_extend_schema(dec):
            continue
        assert isinstance(dec, ast.Call)
        for kw in dec.keywords:
            if kw.arg == name:
                yield kw.value


_QUERY_ATTRS = frozenset(("GET", "query_params"))
_READ_METHODS = frozenset(("get", "getlist", "pop"))
# Counting or iterating the dict does not read a parameter out of it, so these
# are not hand-offs. Anything else receiving the whole dict might read anything.
_CONTAINER_OPS = frozenset(
    (
        "len",
        "list",
        "set",
        "tuple",
        "sorted",
        "dict",
        "bool",
        "any",
        "all",
        "iter",
        "append",
        "extend",
        "update",
        "dumps",
    )
)
_COPY_METHODS = frozenset(("copy", "dict"))


def _looks_like_a_class(func: ast.expr) -> bool:
    """Callee named like a class, which is how a serializer is spelled."""
    return _name_of(func).rsplit(".", 1)[-1][:1].isupper()


def _is_request(node: ast.expr) -> bool:
    """The handler's request argument, as `request` or `self.request`."""
    if isinstance(node, ast.Name):
        return node.id == "request"
    return isinstance(node, ast.Attribute) and node.attr == "request"


def _unwrap_copy(node: ast.expr) -> ast.expr:
    """Strip `.copy()` / `.dict()` so `request.GET.copy()` still reads as the source."""
    while (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr in _COPY_METHODS
    ):
        node = node.func.value
    return node


def _declared_elements(value: ast.expr) -> list[ast.expr]:
    """Serializers in one `@extend_schema` value, which may be a sequence or a
    media-type mapping such as `request={"multipart/form-data": Upload}`."""
    if isinstance(value, (ast.List, ast.Tuple)):
        return list(value.elts)
    if isinstance(value, ast.Dict):
        return [v for v in value.values if v is not None]
    return [value]


def _declared_names(decorators: list[ast.expr], keyword: str) -> set[str]:
    """Short names declared under `@extend_schema(<keyword>=...)`."""
    names: set[str] = set()
    for value in extend_schema_kwarg(decorators, keyword):
        for element in _declared_elements(value):
            names.add(_name_of(element).rsplit(".", 1)[-1])
    return names


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


def _decorator_response_Ts(decorator: ast.expr) -> list[ast.expr]:
    """Every `T` in `@extend_schema(responses={N: inline_sentry_response_serializer(...)})`.

    Only that form carries a resolvable `T`; serializer classes, `RESPONSE_*`
    constants and `OpenApiResponse(...)` yield none, and status is ignored."""
    if not is_extend_schema(decorator):
        return []
    assert isinstance(decorator, ast.Call)
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


_UNION_NAMES = frozenset({"Union", "Optional"})


def _is_union_subscript(node: ast.expr) -> ast.expr | None:
    """Slice of `Union[...]` / `Optional[...]`, bare or `typing.`-prefixed.

    `Optional[X]`'s implicit `None` arm cannot encode a bare `Response`, so
    unwrapping `X` alone is enough."""
    if not isinstance(node, ast.Subscript):
        return None
    val = node.value
    if isinstance(val, ast.Name) and val.id in _UNION_NAMES:
        return node.slice
    if isinstance(val, ast.Attribute) and val.attr in _UNION_NAMES:
        return node.slice
    return None


def _extract_response_annotation_Ts(returns: ast.expr | None) -> list[ast.expr] | None:
    """Every `T` inside `Response[...]`, across single and union annotations.

    `None` when the annotation is not `Response[T]` — the unmigrated state, skipped."""
    if returns is None:
        return None

    # Collect every leaf of a union, then check each is `Response[T]`. Both union
    # spellings are unwrapped, matching _annotation_has_bare_response.
    arms: list[ast.expr] = []
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
        arms.append(node)

    extracted: list[ast.expr] = []
    for arm in arms:
        if isinstance(arm, ast.Constant) and arm.value is None:
            # A `None` arm carries no T and does not stop the Response arms from
            # being compared.
            continue
        T = _is_response_subscript(arm)
        if T is None:
            # A bare `Response` or some other type: nothing to compare against.
            return None
        extracted.append(T)
    return extracted or None


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


def _decorator_name(dec: ast.expr) -> str | None:
    fn = dec.func if isinstance(dec, ast.Call) else dec
    return getattr(fn, "id", getattr(fn, "attr", None))


_EMPTY_ROOTS = frozenset({"Serializer", "TypedDict", "object"})


def _base_name(node: ast.expr) -> str | None:
    """Name of a base class, unwrapping generic subscripts like Serializer[T]."""
    if isinstance(node, ast.Subscript):
        node = node.value
    return node.id if isinstance(node, ast.Name) else getattr(node, "attr", None)


def _class_field_names(cls: ast.ClassDef, classes: dict[str, ast.ClassDef]) -> set[str]:
    """Field names on cls, following bases defined in the same file."""
    names: set[str] = set()
    seen: set[str] = set()
    stack = [cls]
    while stack:
        node = stack.pop()
        if node.name in seen:
            continue
        seen.add(node.name)
        for stmt in node.body:
            if isinstance(stmt, ast.Assign):
                for t in stmt.targets:
                    if isinstance(t, ast.Name):
                        names.add(t.id)
            elif isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
                names.add(stmt.target.id)
            elif isinstance(stmt, ast.ClassDef) and stmt.name == "Meta":
                for m in stmt.body:
                    if not isinstance(m, ast.Assign):
                        continue
                    # Every target, so a chained `x = fields = [...]` still counts.
                    if not any(isinstance(t, ast.Name) and t.id == "fields" for t in m.targets):
                        continue
                    if isinstance(m.value, (ast.List, ast.Tuple)):
                        names.update(
                            e.value
                            for e in m.value.elts
                            if isinstance(e, ast.Constant) and isinstance(e.value, str)
                        )
                    else:
                        # `fields = "__all__"` or any non-literal: the field set comes
                        # from the model, so it cannot be enumerated here.
                        names.add("*")
        for base in node.bases:
            bn = _base_name(base)
            if bn in classes:
                stack.append(classes[bn])
            elif bn in _EMPTY_ROOTS or bn is None:
                continue
            else:
                # base defined elsewhere: we cannot enumerate it, so treat the
                # class as open and skip the "field does not exist" check
                names.add("*")
    return names


def _string_entries(node: ast.expr) -> list[str]:
    if isinstance(node, (ast.List, ast.Tuple)):
        return [
            e.value for e in node.elts if isinstance(e, ast.Constant) and isinstance(e.value, str)
        ]
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        # a bare string "works" only by substring match; report it as one entry
        return [node.value]
    return []


def _joined_str(node: ast.expr) -> str | None:
    """Concatenated string literal, or None when not statically a string."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left, right = _joined_str(node.left), _joined_str(node.right)
        return None if left is None or right is None else left + right
    return None


def _repo_relative(filename: str) -> str:
    """Repo-relative path for safelist matching, tolerant of absolute paths."""
    normalized = filename.replace("\\", "/")
    for marker in ("/src/sentry/", "/tools/", "/tests/"):
        idx = normalized.rfind(marker)
        if idx != -1:
            return normalized[idx + 1 :]
    return normalized.lstrip("./")


class _InputCtx:
    """One PUBLIC method's input sources, gathered during the single traversal."""

    def __init__(self, declared_params: set[str], declared_body: set[str]) -> None:
        self.declared_params = declared_params
        self.declared_body = declared_body
        self.query_locals: set[str] = set()
        self.body_locals: set[str] = set()
        # (line, col, serializer) for each serializer built from that source
        self.query_validators: list[tuple[int, int, str]] = []
        self.body_validators: list[tuple[int, int, str]] = []
        # (line, col, key, source) reads with a literal key
        self.literal_reads: list[tuple[int, int, str, str]] = []
        # (line, col, rendered key, source) reads whose key is computed
        self.computed_reads: list[tuple[int, int, str, str]] = []
        # (line, col, callee, source) the whole dict passed somewhere
        self.hand_offs: list[tuple[int, int, str, str]] = []

    def _is(self, node: ast.expr, attrs: frozenset[str], locals_: set[str]) -> bool:
        node = _unwrap_copy(node)
        if isinstance(node, ast.Name):
            return node.id in locals_
        # The attribute has to hang off the request. `serializer.data` and
        # `response.data` are outputs, not parameters a client sent.
        return isinstance(node, ast.Attribute) and node.attr in attrs and _is_request(node.value)

    def is_query(self, node: ast.expr) -> bool:
        return self._is(node, _QUERY_ATTRS, self.query_locals)

    def is_body(self, node: ast.expr) -> bool:
        return self._is(node, frozenset(("data",)), self.body_locals)

    def source_of(self, node: ast.expr) -> str | None:
        """ "query string" / "request body" for an input source, else None."""
        if self.is_query(node):
            return "query string"
        if self.is_body(node):
            return "request body"
        return None

    def record_read(self, key: ast.expr, source: str, line: int, col: int) -> None:
        if isinstance(key, ast.Constant) and isinstance(key.value, str):
            self.literal_reads.append((line, col, key.value, source))
        else:
            self.computed_reads.append((line, col, ast.unparse(key), source))


class SentryVisitor(ast.NodeVisitor):
    def __init__(
        self,
        filename: str,
        s015_year: int,
        s015_msg: str,
        eap_suite_classes: set[str] | None = None,
    ) -> None:
        self.errors: list[tuple[int, int, str]] = []
        self.filename = filename
        self._s015_year = s015_year
        self._s015_msg = s015_msg
        self._eap_suite_classes = eap_suite_classes or set()

        self._except_vars: list[str | None] = []
        self._function_depth = 0
        # S024: a hand-rolled linter both finds .py files and parses them.
        self._s024_discovers_py = False
        self._s024_parses: tuple[int, int] | None = None
        # Module-level classes, indexed as encountered. A base is always defined
        # before its subclass at module level, so in-order indexing suffices.
        self._module_classes: dict[str, ast.ClassDef] = {}
        # publish_status of the enclosing module-level class, for S022.
        self._publish_status: dict[str, str] | None = None
        # Input rules: per-method accumulation, innermost last.
        self._input_stack: list[_InputCtx] = []
        self._class_decorators: list[ast.expr] = []
        self._class_stack: list[str] = []
        self._function_stack: list[str] = []

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module and not node.level:
            if node.module.split(".")[0] in S003_modules:
                self.errors.append((node.lineno, node.col_offset, S003_msg))
            elif node.module == "sentry.models":
                self.errors.append((node.lineno, node.col_offset, S005_msg))
            elif (
                ("tests/" in self.filename or "testutils/" in self.filename)
                and node.module == "django.utils.encoding"
                and any(x.name in {"force_bytes", "force_str"} for x in node.names)
            ):
                self.errors.append((node.lineno, node.col_offset, S006_msg))
            elif (
                "tests/" in self.filename or "testutils/" in self.filename
            ) and node.module == "dateutil.parser":
                self.errors.append((node.lineno, node.col_offset, S008_msg))
            elif (
                "tests/" not in self.filename
                and "fixtures/" not in self.filename
                and "sentry/testutils/" not in self.filename
                and "sentry.testutils" in node.module
            ):
                self.errors.append((node.lineno, node.col_offset, S007_msg))
            elif node.module == "rest_framework.permissions" and any(
                x.name == "IsAuthenticated" for x in node.names
            ):
                self.errors.append((node.lineno, node.col_offset, S012_msg))
            elif node.module == "sentry.db.models.fields.array":
                self.errors.append((node.lineno, node.col_offset, S013_msg))
            elif node.module == "concurrent.futures" and any(
                x.name == "ThreadPoolExecutor" for x in node.names
            ):
                self.errors.append((node.lineno, node.col_offset, S016_msg))
            elif node.module == S018_module and any(
                x.name == "PyMemcacheCache" for x in node.names
            ):
                self.errors.append((node.lineno, node.col_offset, S018_msg))

        if (
            _is_platform_path(self.filename)
            and node.module
            and not node.level
            and _is_non_platform_import(node.module)
        ):
            self.errors.append((node.lineno, node.col_offset, S017_msg))

        self.generic_visit(node)

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            if alias.name.split(".")[0] in S003_modules:
                self.errors.append((node.lineno, node.col_offset, S003_msg))
            elif (
                "tests/" not in self.filename
                and "fixtures/" not in self.filename
                and "sentry/testutils/" not in self.filename
                and "sentry.testutils" in alias.name
            ):
                self.errors.append((node.lineno, node.col_offset, S007_msg))

        if _is_platform_path(self.filename):
            for alias in node.names:
                if _is_non_platform_import(alias.name):
                    self.errors.append((node.lineno, node.col_offset, S017_msg))

        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if node.attr in S001_methods:
            self.errors.append((node.lineno, node.col_offset, S001_fmt.format(node.attr)))
        elif node.attr in S004_methods:
            self.errors.append((node.lineno, node.col_offset, S004_msg))
        elif (
            node.attr == "ThreadPoolExecutor"
            and isinstance(node.value, ast.Attribute)
            and node.value.attr == "futures"
            and isinstance(node.value.value, ast.Name)
            and node.value.value.id == "concurrent"
        ):
            self.errors.append((node.lineno, node.col_offset, S016_msg))

        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        if node.id == "print":
            self.errors.append((node.lineno, node.col_offset, S002_msg))

        self.generic_visit(node)

    def visit_Constant(self, node: ast.Constant) -> None:
        if isinstance(node.value, str) and node.value == S018_fqn:
            self.errors.append((node.lineno, node.col_offset, S018_msg))

        self.generic_visit(node)

    def visit_arg(self, node: ast.arg) -> None:
        if node.arg == "monkeypatch":
            self.errors.append((node.lineno, node.col_offset, S014_msg))

        self.generic_visit(node)

    def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
        self._except_vars.append(node.name)
        try:
            self.generic_visit(node)
        finally:
            self._except_vars.pop()

    def visit_Raise(self, node: ast.Raise) -> None:
        if (
            self._except_vars
            and isinstance(node.exc, ast.Name)
            and node.exc.id == self._except_vars[-1]
        ):
            self.errors.append((node.lineno, node.col_offset, S009_msg))
        self.generic_visit(node)

    def visit_Try(self, node: ast.Try) -> None:
        if (
            node.handlers
            and len(node.handlers[-1].body) == 1
            and isinstance(node.handlers[-1].body[0], ast.Raise)
            and node.handlers[-1].body[0].exc is None
        ):
            self.errors.append((node.handlers[-1].lineno, node.handlers[-1].col_offset, S010_msg))

        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        top_level = not self._class_stack
        if top_level:
            self._module_classes[node.name] = node
            self._check_S023(node)
        outer_publish_status = self._publish_status
        self._publish_status = publish_status(node) if top_level else None
        outer_decorators = self._class_decorators
        self._class_decorators = node.decorator_list if top_level else []
        self._class_stack.append(node.name)
        try:
            self.generic_visit(node)
        finally:
            self._class_stack.pop()
            self._publish_status = outer_publish_status
            self._class_decorators = outer_decorators

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        if len(self._class_stack) == 1 and self._function_depth == 0:
            self._check_S021(node)
            self._check_S022(node)
        entered = self._enter_input(node)
        self._function_depth += 1
        self._function_stack.append(node.name)
        try:
            self.generic_visit(node)
        finally:
            self._function_stack.pop()
            self._function_depth -= 1
            if entered:
                self._exit_input()

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        if len(self._class_stack) == 1 and self._function_depth == 0:
            self._check_S021(node)
            self._check_S022(node)
        entered = self._enter_input(node)
        self._function_depth += 1
        self._function_stack.append(node.name)
        try:
            self.generic_visit(node)
        finally:
            self._function_stack.pop()
            self._function_depth -= 1
            if entered:
                self._exit_input()

    def visit_Lambda(self, node: ast.Lambda) -> None:
        self._function_depth += 1
        try:
            self.generic_visit(node)
        finally:
            self._function_depth -= 1

    def visit_Assign(self, node: ast.Assign) -> None:
        if self._input_stack:
            ctx = self._input_stack[-1]
            for target in node.targets:
                if not isinstance(target, ast.Name):
                    continue
                if ctx.is_query(node.value):
                    ctx.query_locals.add(target.id)
                elif ctx.is_body(node.value):
                    ctx.body_locals.add(target.id)
        if (
            _is_tests_path(self.filename)
            and self._function_depth == 0
            and len(node.targets) == 1
            and isinstance(node.targets[0], ast.Name)
            and isinstance(node.value, ast.Call)
        ):
            y = _wall_clock_year_from_datetime_call(node.value)
            if y is not None and y >= self._s015_year:
                self.errors.append((node.lineno, node.col_offset, self._s015_msg))
        self.generic_visit(node)

    def _check_S021(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        annot = _extract_response_annotation_Ts(node.returns)
        if annot is None:
            return
        declared: list[ast.expr] = []
        for dec in node.decorator_list:
            declared.extend(_decorator_response_Ts(dec))
        if not declared:
            return
        decl_set = {_name_of(t) for t in declared}
        annot_set = {_name_of(t) for t in annot}
        missing = decl_set - annot_set
        if missing:
            self.errors.append(
                (node.lineno, node.col_offset, S021_msg.format(", ".join(sorted(missing))))
            )

    def _check_S022(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        if not self._publish_status or node.name not in HTTP_METHODS:
            return
        if self._publish_status.get(node.name.upper()) != "PUBLIC":
            return
        if node.returns is None:
            self.errors.append((node.lineno, node.col_offset, S022_missing_msg))
        elif _annotation_has_bare_response(node.returns):
            self.errors.append((node.lineno, node.col_offset, S022_bare_msg))

    def _check_S023(self, node: ast.ClassDef) -> None:
        for dec in node.decorator_list:
            if not isinstance(dec, ast.Call):
                continue
            if _decorator_name(dec) not in (
                "extend_schema_serializer",
                "sentry_schema_serializer",
            ):
                continue
            fields = _class_field_names(node, self._module_classes)
            open_class = "*" in fields
            for kw in dec.keywords:
                if kw.arg == "exclude_fields":
                    for field in _string_entries(kw.value):
                        self.errors.append(
                            (dec.lineno, dec.col_offset, S023_no_reason_msg.format(field, field))
                        )
                        if not open_class and field not in fields:
                            self.errors.append(
                                (
                                    dec.lineno,
                                    dec.col_offset,
                                    S023_ghost_msg.format("exclude_fields", field),
                                )
                            )
                elif kw.arg == "omit_from_public_schema":
                    if not isinstance(kw.value, ast.Dict):
                        self.errors.append((dec.lineno, dec.col_offset, S023_not_mapping_msg))
                        continue
                    for k, v in zip(kw.value.keys, kw.value.values):
                        if not isinstance(k, ast.Constant) or not isinstance(k.value, str):
                            continue
                        field = k.value
                        reason = _joined_str(v)
                        if reason is not None and not reason.strip():
                            self.errors.append(
                                (
                                    dec.lineno,
                                    dec.col_offset,
                                    S023_blank_reason_msg.format(field),
                                )
                            )
                        if not open_class and field not in fields:
                            self.errors.append(
                                (
                                    dec.lineno,
                                    dec.col_offset,
                                    S023_ghost_msg.format("omit_from_public_schema", field),
                                )
                            )

    def _s024_visit_call(self, node: ast.Call) -> None:
        func = node.func
        if not isinstance(func, ast.Attribute):
            return
        if func.attr in _S024_discovery_methods or func.attr == "endswith":
            # glob("*.py") / rglob("*.py"), or a manual fname.endswith(".py") filter
            if any(
                isinstance(a, ast.Constant) and isinstance(a.value, str) and a.value.endswith(".py")
                for a in node.args
            ):
                self._s024_discovers_py = True
        elif func.attr == "parse" and isinstance(func.value, ast.Name) and func.value.id == "ast":
            if self._s024_parses is None:
                self._s024_parses = (node.lineno, node.col_offset)

    def visit_Subscript(self, node: ast.Subscript) -> None:
        # Load only: `request.data["title"] = ...` writes a value, it does not
        # read a parameter the client sent.
        if self._input_stack and isinstance(node.ctx, ast.Load):
            ctx = self._input_stack[-1]
            source = ctx.source_of(node.value)
            if source is not None:
                ctx.record_read(node.slice, source, node.lineno, node.col_offset)
        self.generic_visit(node)

    def _enter_input(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
        """Push an accumulator for a PUBLIC HTTP method on an endpoint class."""
        if len(self._class_stack) != 1 or self._function_depth != 0:
            return False
        if not self._publish_status or node.name not in HTTP_METHODS:
            return False
        if self._publish_status.get(node.name.upper()) != "PUBLIC":
            return False
        decorators = self._class_decorators + node.decorator_list
        self._input_stack.append(
            _InputCtx(
                _declared_names(decorators, "parameters"),
                _declared_names(decorators, "request"),
            )
        )
        return True

    def _record_input_call(self, node: ast.Call) -> None:
        """A `.get()` read, or the whole dict handed to something else."""
        ctx = self._input_stack[-1]
        func = node.func
        if isinstance(func, ast.Attribute) and func.attr in _READ_METHODS:
            source = ctx.source_of(func.value)
            if source is not None and node.args:
                ctx.record_read(node.args[0], source, node.lineno, node.col_offset)
            # On anything but the request this is an ordinary lookup, and
            # `options.get("k", request.GET)` passes a default, not the dict.
            return
        # Only a serializer's data= is the target shape. `my_func(data=...)`
        # hands the dict over exactly as a positional argument would.
        if _looks_like_a_class(func) and any(kw.arg == "data" for kw in node.keywords):
            return
        for argument in [*node.args, *(keyword.value for keyword in node.keywords)]:
            source = ctx.source_of(argument)
            if source is not None:
                name = _name_of(func).rsplit(".", 1)[-1]
                if name not in _CONTAINER_OPS:
                    ctx.hand_offs.append((node.lineno, node.col_offset, name, source))
                return

    def _record_validator(self, node: ast.Call) -> None:
        """A serializer built from the query string or the request body."""
        ctx = self._input_stack[-1]
        for keyword in node.keywords:
            if keyword.arg != "data":
                continue
            # A class, by convention. Skips plain calls taking data=, and
            # runtime-chosen classes the schema could not name either.
            if not _looks_like_a_class(node.func):
                continue
            name = _name_of(node.func).rsplit(".", 1)[-1]
            if ctx.is_query(keyword.value):
                ctx.query_validators.append((node.lineno, node.col_offset, name))
            elif ctx.is_body(keyword.value):
                ctx.body_validators.append((node.lineno, node.col_offset, name))

    def _report_input(self, line: int, col: int, msg: str, rule: str) -> None:
        """Fatal only for an enforced rule; otherwise recorded unless asked for."""
        if rule in ENFORCED or os.environ.get(INPUT_LINT_ALL_ENV):
            self.errors.append((line, col, msg))

    def _exit_input(self) -> None:
        ctx = self._input_stack.pop()
        for line, col, name in ctx.query_validators:
            if name not in ctx.declared_params:
                self._report_input(line, col, S025_query_msg.format(name), "declared")
        for line, col, name in ctx.body_validators:
            if name not in ctx.declared_body:
                self._report_input(line, col, S025_body_msg.format(name), "declared")
        for line, col, key, source in ctx.literal_reads:
            self._report_input(line, col, S026_msg.format(repr(key), source), "shaped")
        for line, col, key, source in ctx.computed_reads:
            self._report_input(line, col, S027_msg.format(source, key), "shaped")
        for line, col, callee, source in ctx.hand_offs:
            self._report_input(line, col, S028_msg.format(source, callee), "shaped")

    def visit_Call(self, node: ast.Call) -> None:
        self._s024_visit_call(node)
        if self._input_stack:
            self._record_validator(node)
            self._record_input_call(node)
        if _is_tests_path(self.filename):
            if (
                isinstance(node.func, ast.Name)
                and node.func.id == "freeze_time"
                and node.args
                and isinstance(node.args[0], ast.Call)
            ):
                y = _wall_clock_year_from_datetime_call(node.args[0])
                if y is not None and y >= self._s015_year:
                    self.errors.append((node.lineno, node.col_offset, self._s015_msg))
        if (
            # override_settings(...)
            (isinstance(node.func, ast.Name) and node.func.id == "override_settings")
            or
            # self.settings(...)
            (
                isinstance(node.func, ast.Attribute)
                and isinstance(node.func.value, ast.Name)
                and node.func.value.id == "self"
                and node.func.attr == "settings"
            )
        ):
            for keyword in node.keywords:
                if keyword.arg == "SENTRY_OPTIONS":
                    self.errors.append((keyword.lineno, keyword.col_offset, S011_msg))

        if isinstance(node.func, ast.Attribute) and node.func.attr in S019_logging_methods:
            for keyword in node.keywords:
                if keyword.arg == "extra" and isinstance(keyword.value, ast.Dict):
                    for key in keyword.value.keys:
                        if (
                            isinstance(key, ast.Constant)
                            and isinstance(key.value, str)
                            and key.value in S019_logrecord_attrs
                        ):
                            self.errors.append(
                                (key.lineno, key.col_offset, S019_fmt.format(key.value))
                            )

        # S020: ban raw self.client.get outside client_get in EAP endpoint suites.
        if (
            _is_eap_events_endpoint_test_path(self.filename)
            and self._class_stack
            and self._class_stack[-1] in self._eap_suite_classes
            and (not self._function_stack or self._function_stack[-1] != "client_get")
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "get"
            and isinstance(node.func.value, ast.Attribute)
            and node.func.value.attr == "client"
            and isinstance(node.func.value.value, ast.Name)
            and node.func.value.value.id == "self"
        ):
            self.errors.append((node.lineno, node.col_offset, S020_msg))

        self.generic_visit(node)


class SentryCheck:
    def __init__(self, tree: ast.AST, filename: str) -> None:
        self.tree = tree
        self.filename = filename

    def run(self) -> Generator[tuple[int, int, str, type[Any]]]:
        cy = datetime.now(timezone.utc).year
        eap_suite_classes = (
            _collect_eap_suite_class_names(self.tree)
            if _is_eap_events_endpoint_test_path(self.filename)
            else set()
        )
        visitor = SentryVisitor(self.filename, cy, _s015_msg(), eap_suite_classes)
        visitor.visit(self.tree)

        yield from self._s024(visitor)

        for e in visitor.errors:
            yield (*e, type(self))

    def _s024(self, visitor: SentryVisitor) -> Generator[tuple[int, int, str, type[Any]]]:
        """Report a module that both discovers and parses .py files."""
        rel = _repo_relative(self.filename)
        hand_rolled = visitor._s024_discovers_py and visitor._s024_parses is not None
        if rel in S024_safelist:
            if not hand_rolled:
                yield (1, 0, S024_stale_msg, type(self))
        elif hand_rolled:
            assert visitor._s024_parses is not None
            line, col = visitor._s024_parses
            yield (line, col, S024_msg, type(self))
