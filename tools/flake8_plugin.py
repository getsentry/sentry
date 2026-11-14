from __future__ import annotations

import ast
import os
from collections import Counter
from collections.abc import Generator, Iterator
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, NamedTuple

from tools.api_guidelines.helper_kinds import Kind
from tools.api_guidelines.rules import ApiRule

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
    f"{ApiRule.S021} Every T declared by inline_sentry_response_serializer(...) in "
    "@extend_schema must appear in the Response[T] return annotation. "
    "Missing from the annotation: {}."
)
S022_missing_msg = (
    f"{ApiRule.S022} Published endpoint methods must declare their response shape. This "
    "method has no return annotation; use Response[YourTypedDict], a union of "
    "Response[T] arms, Response[None], or a non-DRF response type."
)
S022_bare_msg = (
    f"{ApiRule.S022} Published endpoint methods must declare their response shape. Bare "
    "`Response` opts the body out of type checking; use Response[YourTypedDict], "
    "a union of Response[T] arms, or Response[None]."
)
S023_no_reason_msg = (
    f"{ApiRule.S023} exclude_fields={{!r}} has no recorded reason. Add a help_text to the "
    "field, or withhold it deliberately with @sentry_schema_serializer("
    'omit_from_public_schema={{{!r}: "<why>"}}).'
)
S023_not_mapping_msg = (
    f"{ApiRule.S023} omit_from_public_schema must be a {{field: reason}} mapping."
)
S023_blank_reason_msg = (
    f"{ApiRule.S023} omit_from_public_schema[{{!r}}] needs a reason explaining why the field "
    "is not public surface."
)
S023_ghost_msg = f"{ApiRule.S023} {{}}={{!r}} names no field on this class; it omits nothing and should be deleted."
S023_bad_path_msg = (
    f"{ApiRule.S023} {{}}={{!r}} is not a usable path. Write 'field' or 'field.choice', "
    "with no leading, trailing or doubled dots."
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

S029_msg = (
    "S029 Seer connection pools must use make_signed_seer_api_request; "
    "raw urlopen bypasses ViewerContext propagation"
)

S030_msg = (
    "S030 Do not add new callers of the legacy Seer LLM generate API; "
    "add a named Seer one-shot so prompts and model selection stay in Seer"
)
S030_stale_msg = (
    "S030 stale legacy Seer LLM generate allowlist entry for {} in {}; "
    "remove it from S030_allowlist"
)
_S030_LEGACY_MODULE = "sentry.seer.signed_seer_api"
_S030_LEGACY_NAMES = frozenset(("LlmGenerateRequest", "make_llm_generate_request"))
_S030_LEGACY_ROUTE = "/v1/llm/generate"
_S030_MODULE_SCOPE = "<module>"

S031_msg = (
    "S031 Do not assign to settings in tests; use override_settings(...) or "
    "override_options(...) so the change is undone in order"
)

S032_msg = (
    "S032 acting_user_id() is None when no user is calling (e.g. a service account), "
    "and a None lookup matches rows with no user; call require_user(request) or handle "
    "None first"
)
# Lookups only: writing None, e.g. to created_by_id, is how a caller with no user is
# recorded.
_S032_query_methods = frozenset(("filter", "exclude", "get", "get_or_create", "update_or_create"))

S033_msg = (
    "S033 Don't assign request.user or request.auth directly; call "
    "set_request_principal(request, user, auth)."
)

# Existing callers are pinned to their exact function and occurrence count. This is a
# shrink-only migration baseline: remove entries as callers move to named Seer one-shots.
S030_allowlist: dict[str, dict[tuple[str, str], int]] = {}


# Rules whose diagnostics are fatal. Empty ships every rule off; adding one
# gates every endpoint of that shape at once, with no baseline to maintain.
ENFORCED: frozenset[str] = frozenset()

# Emit regardless of ENFORCED, so a plain flake8 run is the backlog inventory.
INPUT_LINT_ALL_ENV = "SENTRY_INPUT_LINT_ALL"

S025_query_msg = (
    f"{ApiRule.S025} {{}} validates the query string but is not declared in "
    "@extend_schema(parameters=...), so the schema does not document what this "
    "endpoint accepts. Add it to parameters=."
)
S026_msg = (
    f"{ApiRule.S026} {{}} is read straight off the {{}} instead of through a serializer declared in "
    "@extend_schema, so nothing ties the schema to what this endpoint accepts. Read it "
    "through a declared serializer, or declare this endpoint's input as an exception."
)
S027_msg = (
    f"{ApiRule.S027} the {{}} is read with the computed key {{}}, so no schema can document it. "
    "Read it through a serializer declared in @extend_schema, or declare this "
    "endpoint's input as an exception."
)
S028_msg = (
    f"{ApiRule.S028} the whole {{}} is handed to {{}}, so what this endpoint accepts cannot be "
    "determined. Validate it with a serializer declared in @extend_schema, or declare "
    "this endpoint's input as an exception."
)
S025_body_msg = (
    f"{ApiRule.S025} {{}} validates the request body but is not declared in "
    "@extend_schema(request=...), so the schema does not document what this "
    "endpoint accepts. Add it as request=."
)
S034_msg = (
    f"{ApiRule.S034} This method returns a {{0}} Response, but {{0}} is not a key in "
    "@extend_schema(responses=...), so the schema does not document it and generated "
    "clients cannot type it. Add it to responses=."
)


def _s015_msg() -> str:
    return (
        "S015 Do not hardcode datetime with current or future UTC year at module/class "
        "scope or in freeze_time(...); use before_now(...), now-timedelta, or an older fixed year"
    )


def _is_tests_path(filename: str) -> bool:
    return "tests/" in filename or "testutils/" in filename


def _is_settings_target(node: ast.expr) -> bool:
    """`settings.FOO`, `settings.FOO["x"]`, `settings.FOO["x"]["y"]`, ..."""
    while isinstance(node, ast.Subscript):
        node = node.value
    return (
        isinstance(node, ast.Attribute)
        and node.attr.isupper()
        and isinstance(node.value, ast.Name)
        and node.value.id == "settings"
    )


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


def _collect_literal_var_constants(tree: ast.AST) -> set[str]:
    """Helper function for getting a file's top level constants that hold string literals.
    This is used to check if top level constants are iterables when we iterate over request fields/params.
    """
    names: set[str] = set()

    # check if the tree is an ast.Module
    if not isinstance(tree, ast.Module):
        return names

    # loop over the tree.body
    for node in tree.body:
        # check for assign nodes
        if isinstance(node, ast.Assign):
            if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                if _is_literal_strings(node.value):
                    names.add(node.targets[0].id)

        # check for ann assign nodes
        elif isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name):
                if node.value and _is_literal_strings(node.value):
                    names.add(node.target.id)

    return names


def _is_literal_strings(node: ast.expr) -> bool:
    """Helper function for checking if a dict, list, or tuple are literal string constants.
    This is used to check if the list of iterables in a for loop are constants
    i.e, for key in ("a", "b") where "a" and "b" are literal strings"""

    # check if its a dict
    if isinstance(node, ast.Dict):
        for key in node.keys:
            # check if the keys in the dict are constants/strings
            if key is None or not isinstance(key, ast.Constant) or not isinstance(key.value, str):
                return False
        return True

    # check if its a tuple or list
    if isinstance(node, (ast.Tuple, ast.List)):
        # check if the elms are constant/strings
        for elm in node.elts:
            if not isinstance(elm, ast.Constant) or not isinstance(elm.value, str):
                return False
        return True

    return False


def _is_iterable_elms_literals(
    node: ast.expr, file_lvl_constants: set[str], declared_serializers: set[str]
) -> bool:
    """Helper function for checking if the iterables in a for loop are a safe and known collection:
    1. An inline literal list/tuple/dict of string literals
    2. A file level constant variable name
    3. A declared serializer's `.fields` attribute
    """
    if (
        isinstance(node, ast.Call)
        and not node.args
        and not node.keywords
        and isinstance(node.func, ast.Attribute)
        and node.func.attr in ("keys", "items")
    ):
        node = (
            node.func.value
        )  # the object the method was being called on so PARAMS.items() becomes PARAMS

    # check if it's a file level constant
    if isinstance(node, ast.Name) and node.id in file_lvl_constants:
        return True

    # check if it's a declared serializer's .fields attribute
    if isinstance(node, ast.Attribute) and node.attr == "fields":
        serializer = node.value
        # check if its MySerializer().fields
        if (
            isinstance(serializer, ast.Call)
            and isinstance(serializer.func, ast.Name)
            and serializer.func.id in declared_serializers
        ):
            return True

    # check if it's an inline literal dict/list/tuple of strings
    return _is_literal_strings(node)


def _loop_var_name(target: ast.expr) -> str | None:
    """The loop variable a for loop or comprehension binds: `for f in ...` or the first of `for f, v in ...`."""
    # check if its a single looping variable
    if isinstance(target, ast.Name):
        return target.id
    # check if its multi looping variables
    if isinstance(target, (ast.Tuple, ast.List)) and target.elts:
        first_var = target.elts[0]
        if isinstance(first_var, ast.Name):
            return first_var.id
    return None


def _fields_serializer(node: ast.expr) -> str | None:
    """X for a loop over `X().fields` (or its .keys() / .items()), else None."""
    if (
        isinstance(node, ast.Call)
        and not node.args
        and not node.keywords
        and isinstance(node.func, ast.Attribute)
        and node.func.attr in ("keys", "items")
    ):
        node = node.func.value
    if (
        isinstance(node, ast.Attribute)
        and node.attr == "fields"
        and isinstance(node.value, ast.Call)
        and isinstance(node.value.func, ast.Name)
    ):
        return node.value.func.id
    return None


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
# ApiPublishStatus members whose `is_published` is true. Mirrored by name because this
# plugin reads source with ast and must not import from src/sentry.
PUBLISHED_STATUSES = frozenset({"PUBLIC", "PUBLIC_EXPERIMENTAL"})


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
        "isinstance",
    )
)
_COPY_METHODS = frozenset(("copy", "dict"))

# Date range helpers should not be flagged for handoffs if allk the params are documented fully
_DATE_RANGE_HELPERS = frozenset(("get_date_range_from_params", "get_date_range_from_stats_period"))
# The current date keys those helpers read, by their GlobalParams name. The
# timeframe aliases are legacy and left out of the public spec on purpose
_DATE_RANGE_PARAMS = frozenset(
    ("START", "END", "STATS_PERIOD", "STATS_PERIOD_START", "STATS_PERIOD_END")
)

_UNRESOLVED: Literal["UNRESOLVED"] = "UNRESOLVED"


def _looks_like_a_class(func: ast.expr) -> bool:
    """Callee named like a class, which is how a serializer is spelled."""
    return _name_of(func).rsplit(".", 1)[-1][:1].isupper()


def _looks_like_a_class_variable(func: ast.expr) -> bool:
    """Callee is a serializer class held in a variable or attribute, like serializer_cls,
    settings.validator or self.get_serializer, which is another way how a serializer is defined."""
    name = _name_of(func).rsplit(".", 1)[-1].lower()
    return name.endswith(("_cls", "serializer", "validator"))


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
    """Short names declared under `@extend_schema(<keyword>=...)`. A serializer
    written with arguments, like `MySerializer(partial=True)`, counts as `MySerializer`"""
    names: set[str] = set()
    for value in extend_schema_kwarg(decorators, keyword):
        for element in _declared_elements(value):
            if isinstance(element, ast.Call):
                element = element.func
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


def _is_acting_user_id(node: ast.expr) -> bool:
    """A call to `acting_user_id(...)`."""
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "acting_user_id"
    )


def _is_named_request(node: ast.expr) -> bool:
    """`request`, `self.request`, `drf_request`, ..."""
    if isinstance(node, ast.Name):
        return node.id.endswith("request")
    return isinstance(node, ast.Attribute) and node.attr.endswith("request")


def _is_request_principal_attr(node: ast.expr) -> bool:
    """`request.user` / `request.auth` on anything named like a request."""
    return (
        isinstance(node, ast.Attribute)
        and node.attr in ("user", "auth")
        and _is_named_request(node.value)
    )


def _unpack_targets(targets: list[ast.expr]) -> Iterator[ast.expr]:
    stack = list(targets)
    while stack:
        target = stack.pop()
        if isinstance(target, (ast.Tuple, ast.List)):
            stack.extend(target.elts)
        else:
            yield target


def _is_seer_connection_pool_call(node: ast.expr) -> bool:
    if not isinstance(node, ast.Call):
        return False
    if _name_of(node.func).rsplit(".", 1)[-1] != "connection_from_url":
        return False

    for argument in [*node.args, *(keyword.value for keyword in node.keywords)]:
        for child in ast.walk(argument):
            if (
                isinstance(child, ast.Attribute)
                and child.attr.startswith("SEER_")
                and child.attr.endswith("_URL")
            ):
                return True
    return False


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


def _documented_statuses(decorators: list[ast.expr]) -> set[int] | None:
    """Status codes keyed in every `@extend_schema(responses={...})` in `decorators`.

    `None` when no decorator declares `responses=`, or when a key can't be read
    statically (a name, a `**` spread, or `responses=` that isn't a dict literal):
    S034 then has nothing reliable to compare against. A `(status, media_type)`
    tuple key counts as its status."""
    statuses: set[int] | None = None
    for value in extend_schema_kwarg(decorators, "responses"):
        if not isinstance(value, ast.Dict):
            return None
        statuses = statuses or set()
        for key in value.keys:
            if isinstance(key, ast.Tuple) and key.elts:
                key = key.elts[0]
            if not isinstance(key, ast.Constant):
                return None
            if isinstance(key.value, int):
                statuses.add(key.value)
            elif isinstance(key.value, str) and key.value.isdigit():
                statuses.add(int(key.value))
            else:
                return None
    return statuses


def _status_code(node: ast.expr) -> int | None:
    """`404` for `404`, `status.HTTP_404_NOT_FOUND`, or a bare `HTTP_404_NOT_FOUND`."""
    if isinstance(node, ast.Constant) and isinstance(node.value, int):
        return node.value
    if isinstance(node, ast.Attribute):
        name = node.attr
    elif isinstance(node, ast.Name):
        name = node.id
    else:
        return None
    parts = name.split("_")
    if len(parts) >= 2 and parts[0] == "HTTP" and parts[1].isdigit():
        return int(parts[1])
    return None


def _inline_response_statuses(
    node: ast.FunctionDef | ast.AsyncFunctionDef,
) -> Iterator[tuple[ast.Call, int]]:
    """Each `return Response(..., status=N)` in `node`'s own body, with its status.

    Nested functions, lambdas, and classes are not entered: their returns don't
    leave this method."""
    pending: list[ast.AST] = list(node.body)
    while pending:
        child = pending.pop()
        if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)):
            continue
        pending.extend(ast.iter_child_nodes(child))
        if not isinstance(child, ast.Return) or not isinstance(child.value, ast.Call):
            continue
        call = child.value
        if _name_of(call.func).rsplit(".", 1)[-1] != "Response":
            continue
        status_expr = next((kw.value for kw in call.keywords if kw.arg == "status"), None)
        if status_expr is None and len(call.args) >= 2:
            status_expr = call.args[1]
        code = _status_code(status_expr) if status_expr is not None else None
        if code is not None:
            yield call, code


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


class _StartEnd(NamedTuple):
    line: int
    column: int
    end_line: int
    end_column: int


def _start_and_end(node: ast.expr) -> _StartEnd:
    """Where a node starts and ends, as ast reports it (columns are 0-based)"""
    return _StartEnd(
        line=node.lineno,
        column=node.col_offset,
        end_line=node.end_lineno or node.lineno,
        end_column=node.end_col_offset or node.col_offset,
    )


@dataclass(frozen=True)
class _FunctionParams:
    """A function's parameter names, split by how a call can fill them."""

    # filled by position in order (posonlyargs + args)
    positional: list[str]
    # filled by name (args + kwonlyargs) since positional-only params can't be passed by name
    keyword: list[str]

    def has(self, name: str) -> bool:
        return name in self.positional or name in self.keyword


def _function_params(node: ast.FunctionDef | ast.AsyncFunctionDef) -> _FunctionParams:
    """A function's parameters. *args and **kwargs are left out, since a payload passed into them
    can't be tied to a parameter name."""
    positional: list[str] = []
    keyword: list[str] = []
    for arg in node.args.posonlyargs:
        positional.append(arg.arg)
    for arg in node.args.args:
        positional.append(arg.arg)
        keyword.append(arg.arg)
    for arg in node.args.kwonlyargs:
        keyword.append(arg.arg)
    return _FunctionParams(positional, keyword)


def _is_staticmethod(node: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    for decorator in node.decorator_list:
        if isinstance(decorator, ast.Name) and decorator.id == "staticmethod":
            return True
    return False


@dataclass(frozen=True)
class _HelperCall:
    """One call a function makes to a possible helper"""

    kind: Kind
    name: str
    # (positional index or keyword name, what request input it carries: "request" / "query string" / "request body")
    passes: list[tuple[int | str, str]]
    # True when the call has *args or **kwargs, so what it forwards is unknown
    starred: bool
    at: _StartEnd


# Short source names used in violation keys, so a query and a body read of the
# same name stay separate violations.
_SOURCE_PREFIX = {"query string": "query", "request body": "body"}


def _append_once(items: list[Any], item: Any) -> None:
    """Append unless already there, since a helper merged twice with different bindings repeats its real reads."""
    if item not in items:
        items.append(item)


# Sources recorded for a function's own parameters, such as "param:params" or "param:req.GET".
# They never reach a report: the merge resolves them with _resolve_source, or drops them.
_PARAM_PREFIX = "param:"


def _resolve_source(source: str, bindings: dict[str, str], for_binding: bool = False) -> str | None:
    """Turn a recorded source into a real one, using what this call bound each parameter to.

    Real sources come back unchanged. A placeholder whose parameter didn't receive request
    input gives None. A whole request ("request") is only kept `for_binding`, so it can pass
    down to the next helper (a read or hand-off of the whole request is silent as before)
    """
    if not source.startswith(_PARAM_PREFIX):
        return source
    param, _, attr = source[len(_PARAM_PREFIX) :].partition(".")
    bound = bindings.get(param)
    if bound is None:
        return None
    if attr == "":
        if bound == "request" and not for_binding:
            return None
        return bound
    # `.GET` / `.data` read off the parameter which only means something on the whole request
    if bound != "request":
        return None
    if attr == "data":
        return "request body"
    return "query string"


@dataclass(frozen=True)
class ApiInputViolation:
    """Structured record of a single S025-S028 API input lint violation.

    Preserves the `Class.method` scope, prefixed input `key`, and full start and end
    position (`line` is 1-based, while `column` is 0-based to match Python's AST and LSP).
    """

    rule: ApiRule
    message: str
    line: int
    column: int
    end_line: int
    end_column: int
    severity: Literal["error", "warning"]
    # Class.method or function where the read or hand-off is. S025 is the public method instead,
    # since it's checked against that method's @extend_schema
    scope: str
    key: str  # source and name, for example "query:id"
    tool: str = "sentry-flake8"
    # for a read or hand-off inside a helper, the first public method (in file order) whose request
    # reaches it, so a module-level helper, which has no class, can still be given an owner
    caller: str | None = None


class _InputCtx:
    """One top-level function's or method's input sources, gathered during the single traversal."""

    def __init__(
        self,
        scope: str,
        declared_params: set[str],
        declared_body: set[str],
        is_public: bool = False,
        class_name: str | None = None,
    ) -> None:
        self.scope = scope
        self.declared_params = declared_params
        self.declared_body = declared_body
        self.query_locals: set[str] = set()
        self.body_locals: set[str] = set()
        # (start_end, serializer) for each serializer built from that source
        self.query_validators: list[tuple[_StartEnd, str]] = []
        self.body_validators: list[tuple[_StartEnd, str]] = []
        # (start_end, key, source) reads with a literal key
        self.literal_reads: list[tuple[_StartEnd, str, str]] = []
        # (start_end, rendered key, source) reads whose key is computed
        self.computed_reads: list[tuple[_StartEnd, str, str]] = []
        # loop variable names currently marked safe (i.e, keys that are known/fixed)
        self.safe_loop_vars: set[str] = set()
        # loop variable -> serializer, for `for f in X().fields` when X isn't declared on this function.
        # A helper has no declared names, so whether X is declared is only known at merge time
        self.field_loop_vars: dict[str, str] = {}
        # (start_end, rendered key, source, serializer) reads keyed by one of those loop variables,
        # dropped in the merge when the public method declares the serializer, otherwise S027
        self.field_reads: list[tuple[_StartEnd, str, str, str]] = []
        # (start_end, callee, source) the whole dict passed somewhere
        self.hand_offs: list[tuple[_StartEnd, str, str]] = []
        # true only for an HTTP method that publish_status marks PUBLIC on a top-level endpoint class
        self.is_public = is_public
        # the class a method is defined in (None for a module-level function)
        self.class_name = class_name
        # this function's parameter names (used to match call arguments to parameters)
        self.params = _FunctionParams([], [])
        # a @staticmethod has no self to skip when a self.X() call's arguments are matched
        self.is_static = False
        # local name -> placeholder, for aliases of a parameter such as `q = params` or `q = req.GET`
        self.param_locals: dict[str, str] = {}
        # names (parameters included) reassigned to something that isn't request input, so reads
        # after that point don't count. Reads earlier in the function were already recorded
        self.rebound_names: set[str] = set()
        # (start_end, serializer, placeholder) for a serializer built from a parameter,
        # sorted into query or body validators once the merge knows what the parameter received
        self.param_validators: list[tuple[_StartEnd, str, str]] = []
        # the calls this function makes to possible helpers
        self.calls: list[_HelperCall] = []
        # for a merged ctx: the position of each read or hand-off -> the scope of the function it's in
        self.found_in: dict[_StartEnd, str] = {}
        # this function's def, kept so leaking_params can be worked out only for helpers that need it
        self.node: ast.FunctionDef | ast.AsyncFunctionDef | None = None
        # parameters whose value can leave this function in a way that isn't recorded as a read or
        # hand-off. A call that passes a payload into one of them keeps its S028, since following
        # the helper would not show where the payload goes. None until the first call that
        # passes a payload into this function asks for it
        self.leaking_params: set[str] | None = None
        # every name this function binds (parameters, assignments, imports, nested defs...), so a plain
        # `helper()` call that could mean a local name isn't followed. None until first needed
        self.bound_names: set[str] | None = None

    def _is(self, node: ast.expr, attrs: frozenset[str], locals_: set[str]) -> bool:
        node = _unwrap_copy(node)
        # `request.GET if c else {}` is a source when either branch is one
        if isinstance(node, ast.IfExp):
            return self._is(node.body, attrs, locals_) or self._is(node.orelse, attrs, locals_)
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
        """ "query string" / "request body" for an input source, a placeholder for one of this
        function's parameters, else None. Real sources are checked first."""
        if self.is_query(node):
            return "query string"
        if self.is_body(node):
            return "request body"
        return self.param_source_of(node)

    def forget_request(self, name: str) -> None:
        """Stops treating `name` as request input from here on, since it was reassigned.
        `name` the local or parameter that was reassigned
        Returns nothing, it only updates what this function tracks
        """
        self.query_locals.discard(name)
        self.body_locals.discard(name)
        self.param_locals.pop(name, None)
        self.rebound_names.add(name)

    def param_source_of(self, node: ast.expr) -> str | None:
        """A placeholder when `node` is one of this function's parameters, or .GET / .data on one.

        `params` -> "param:params", `req.GET` -> "param:req.GET", `req.data` -> "param:req.data".
        What the parameter actually holds is only known per call, so the merge resolves it.
        """
        node = _unwrap_copy(node)
        if isinstance(node, ast.Name):
            if node.id in self.param_locals:
                return self.param_locals[node.id]
            if node.id in self.rebound_names:
                return None
            if node.id not in ("self", "cls") and self.params.has(node.id):
                return f"{_PARAM_PREFIX}{node.id}"
            return None
        if isinstance(node, ast.Attribute) and (node.attr in _QUERY_ATTRS or node.attr == "data"):
            whole = self.param_source_of(node.value)
            # .GET / .data only make sense on a whole parameter, not on `req.GET.data`
            if whole is None or "." in whole:
                return None
            if node.attr == "data":
                return f"{whole}.data"
            return f"{whole}.GET"
        return None

    def record_read(self, key: ast.expr, source: str, node: ast.expr) -> None:
        if isinstance(key, ast.Constant) and isinstance(key.value, str):
            self.literal_reads.append((_start_and_end(node), key.value, source))
        elif isinstance(key, ast.Name) and key.id in self.safe_loop_vars:
            return
        elif isinstance(key, ast.Name) and key.id in self.field_loop_vars:
            self.field_reads.append(
                (_start_and_end(node), key.id, source, self.field_loop_vars[key.id])
            )
        else:
            self.computed_reads.append((_start_and_end(node), ast.unparse(key), source))


# Calls that only look at a payload, so passing one doesn't leak it
_PAYLOAD_CHECK_CALLS = frozenset(("isinstance", "len", "bool"))


def _parent_map(node: ast.FunctionDef | ast.AsyncFunctionDef) -> dict[ast.AST, ast.AST]:
    """Each node in a function's body mapped to the node that contains it.
    `node` the function's def
    Returns a {child: parent} dict for every node under the body (not the decorators or arguments)
    """
    parents: dict[ast.AST, ast.AST] = {}
    for statement in node.body:
        for parent in ast.walk(statement):
            for child in ast.iter_child_nodes(parent):
                parents[child] = parent
    return parents


def _is_test_position(node: ast.AST, parents: dict[ast.AST, ast.AST]) -> bool:
    """Whether a value is only checked for truthiness, like `if q:`, `not q` or `if q and xyz`.
    `node` the value being checked
    `parents` the function's {child: parent} map
    Returns True when the value itself can't escape through that expression
    """
    parent = parents.get(node)
    if isinstance(parent, ast.UnaryOp) and isinstance(parent.op, ast.Not):
        return True
    while isinstance(parent, ast.BoolOp):
        node = parent
        parent = parents.get(node)
        if isinstance(parent, ast.UnaryOp) and isinstance(parent.op, ast.Not):
            return True
    if isinstance(parent, (ast.If, ast.While, ast.IfExp, ast.Assert)):
        return parent.test is node
    return False


def _payload_use_is_recorded(
    name: ast.Name, parents: dict[ast.AST, ast.AST], aliases: dict[str, str]
) -> bool:
    """Whether one use of a parameter (or an alias of it) is a read, hand-off or check the plugin
    records or deliberately ignores, so the value can't leave the function unseen.
    `name` the use of the parameter
    `parents` the function's {child: parent} map
    `aliases` local name -> parameter name, the parameters themselves included
    Returns False for anything else (returned, yielded, stored, iterated, put in a container, etc.)
    """
    node: ast.AST = name
    parent = parents.get(node)
    # since `q.copy()` / `q.dict()` is still q
    while isinstance(parent, ast.Attribute) and parent.attr in _COPY_METHODS:
        copy_call = parents.get(parent)
        if not (isinstance(copy_call, ast.Call) and copy_call.func is parent):
            break
        node = copy_call
        parent = parents.get(node)

    # q.get("k") / q.getlist("k") / q.pop("k") read a key
    if isinstance(parent, ast.Attribute):
        call = parents.get(parent)
        return parent.attr in _READ_METHODS and isinstance(call, ast.Call) and call.func is parent
    # q["k"]
    if isinstance(parent, ast.Subscript):
        return parent.value is node
    # "k" in q, q is None
    if isinstance(parent, ast.Compare) and len(parent.ops) == 1:
        op = parent.ops[0]
        if isinstance(op, (ast.In, ast.NotIn)):
            return parent.comparators[0] is node
        if isinstance(op, (ast.Is, ast.IsNot)):
            other = parent.comparators[0] if parent.left is node else parent.left
            return isinstance(other, ast.Constant) and other.value is None
        return False
    if _is_test_position(node, parents):
        return True
    # q2 = q, whose own uses are checked too
    if isinstance(parent, ast.Assign) and parent.value is node:
        for target in parent.targets:
            if not (isinstance(target, ast.Name) and target.id in aliases):
                return False
        return True

    # an argument to a call
    keyword = None
    if isinstance(parent, ast.keyword):
        keyword = parent
        parent = parents.get(parent)
    if not isinstance(parent, ast.Call) or parent.func is node:
        return False
    func = parent.func
    # options.get("k", q) passes a default which isn't recorded
    if isinstance(func, ast.Attribute) and func.attr in _READ_METHODS:
        return False
    # a serializer's `data =` (the whole call is skipped, so only the data= value counts)
    if (_looks_like_a_class(func) or _looks_like_a_class_variable(func)) and any(
        kw.arg == "data" for kw in parent.keywords
    ):
        return keyword is not None and keyword.arg == "data"
    callee = _name_of(func).rsplit(".", 1)[-1]
    if callee in _PAYLOAD_CHECK_CALLS:
        return True
    # list(q), sorted(q), lst.append(q), etc copy the payload without recording it
    if callee in _CONTAINER_OPS:
        return False
    # recorded as a hand-off
    return True


def _payload_leaking_params(
    node: ast.FunctionDef | ast.AsyncFunctionDef, ctx: _InputCtx
) -> set[str]:
    """The parameters of a function whose value can leave it without being recorded.
    `node` the function's def
    `ctx` the function's facts, already gathered (its parameters and their aliases)
    Returns the names of the leaking parameters
    """
    # local name -> the parameter it stands for, the parameters themselves included
    aliases: dict[str, str] = {}
    for param in ctx.params.positional + ctx.params.keyword:
        if param not in ("self", "cls"):
            aliases[param] = param
    for local, placeholder in ctx.param_locals.items():
        rest = placeholder[len(_PARAM_PREFIX) :]
        # only aliases of the whole parameter, not of `req.GET` on a request parameter
        if "." not in rest:
            aliases[local] = rest

    parents = _parent_map(node)
    leaking: set[str] = set()
    # how many times each alias is assigned; the assignment that made it is the first
    alias_stores: dict[str, int] = {}
    for statement in node.body:
        for child in ast.walk(statement):
            if not (isinstance(child, ast.Name) and child.id in aliases):
                continue
            if isinstance(child.ctx, ast.Store):
                # `q = { xyz }` after `def _h(self, q)` means later uses of q may not be the payload,
                # so following the helper can't show where the payload went
                if aliases[child.id] == child.id:
                    leaking.add(child.id)
                else:
                    alias_stores[child.id] = alias_stores.get(child.id, 0) + 1
                    if alias_stores[child.id] > 1:
                        leaking.add(aliases[child.id])
            elif isinstance(child.ctx, ast.Load):
                if not _payload_use_is_recorded(child, parents, aliases):
                    leaking.add(aliases[child.id])
    return leaking


def _scope_binding_counts(statements: list[ast.stmt]) -> dict[str, int]:
    """How many times each name is bound directly in a module or class body.
    `statements` the module's or class's body
    Returns {name: count}, counting defs, classes, assignments, imports and every other binding,
    including ones under if/try/for, but not the ones inside function or class bodies
    """
    counts: dict[str, int] = {}

    def add(name: str) -> None:
        counts[name] = counts.get(name, 0) + 1

    def walk(node: ast.AST) -> None:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            add(node.name)
            return
        if isinstance(node, ast.Lambda):
            return
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for alias in node.names:
                if alias.name != "*":
                    add(alias.asname or alias.name.split(".")[0])
            return
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
            add(node.id)
        if isinstance(node, ast.ExceptHandler) and node.name:
            add(node.name)
        for child in ast.iter_child_nodes(node):
            walk(child)

    for statement in statements:
        walk(statement)
    return counts


def _function_bound_names(node: ast.FunctionDef | ast.AsyncFunctionDef) -> set[str]:
    """Every name a function binds anywhere inside it, nested functions included.
    `node` the function's def
    Returns the names of its parameters, assignment / for / with / except,
    imports, nested defs and classes, and global / nonlocal declarations
    """
    names: set[str] = set()
    for child in ast.walk(node):
        if child is node:
            continue
        if isinstance(child, ast.arg):
            names.add(child.arg)
        elif isinstance(child, ast.Name) and isinstance(child.ctx, ast.Store):
            names.add(child.id)
        elif isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            names.add(child.name)
        elif isinstance(child, (ast.Import, ast.ImportFrom)):
            for alias in child.names:
                names.add(alias.asname or alias.name.split(".")[0])
        elif isinstance(child, ast.ExceptHandler) and child.name:
            names.add(child.name)
        elif isinstance(child, (ast.Global, ast.Nonlocal)):
            for name in child.names:
                names.add(name)
    return names


def _binds_name(ctx: _InputCtx, name: str) -> bool:
    """Whether a function binds `name` itself, so a plain `name()` call in it may not be the
    module-level function.
    `ctx` the function making the call
    `name` the called name
    Returns True when the function has a parameter, local, import or nested def by that name
    """
    if ctx.bound_names is None:
        # check if every stored ctx has its def
        assert ctx.node is not None
        ctx.bound_names = _function_bound_names(ctx.node)
    return name in ctx.bound_names


def _target_names(target: ast.AST) -> list[str]:
    """The plain names an assignment target binds, so `a, (b, *c) = xyz` gives a, b and c
    `target` the target being assigned to
    Returns the names, or an empty list for attribute and subscript targets
    """
    names: list[str] = []
    for node in ast.walk(target):
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
            names.append(node.id)
    return names


def _touches_source(ctx: _InputCtx, value: ast.expr) -> bool:
    """Whether any part of `value` is request input, like `data["inner"]` or `clean(q)`, so the name
    it's assigned to may still hold client input and keeps being tracked.
    `ctx` the function being visited
    `value` the assigned value
    Returns True when some part of it is a query string, body or parameter placeholder
    """
    for node in ast.walk(value):
        if isinstance(node, ast.expr) and ctx.source_of(node) is not None:
            return True
    return False


def _leaks_a_payload(helper_ctx: _InputCtx, bindings: dict[str, str]) -> bool:
    """Whether a call hands a payload to a helper parameter it can leave through unseen.
    `helper_ctx` the helper being called
    `bindings` what each of its parameters received from the call
    Returns True when a query string or body lands in one of the helper's leaking parameters
    """
    for param, bound in bindings.items():
        if bound not in _SOURCE_PREFIX:
            continue
        if helper_ctx.leaking_params is None:
            assert helper_ctx.node is not None  # every stored ctx has its def
            helper_ctx.leaking_params = _payload_leaking_params(helper_ctx.node, helper_ctx)
        if param in helper_ctx.leaking_params:
            return True
    return False


class SentryVisitor(ast.NodeVisitor):
    def __init__(
        self,
        filename: str,
        s015_year: int,
        s015_msg: str,
        eap_suite_classes: set[str] | None = None,
    ) -> None:
        self.errors: list[tuple[int, int, str]] = []
        # Every S025-S028 violation, enforced or not; see get_api_violations
        self.api_violations: list[ApiInputViolation] = []
        self.filename = filename
        self._s015_year = s015_year
        self._s015_msg = s015_msg
        self._eap_suite_classes = eap_suite_classes or set()

        self._except_vars: list[str | None] = []
        self._function_depth = 0
        # S024: a hand-rolled linter both finds .py files and parses them.
        self._s024_discovers_py = False
        self._s024_parses: tuple[int, int] | None = None
        # S029: pools created from SEER_*_URL must not make raw requests.
        self._s029_seer_pool_names: set[str] = set()
        self._s029_urlopen_calls: list[tuple[int, int, str]] = []
        # S030: legacy generic Seer LLM API imports, calls, and route bypasses.
        self._s030_legacy_names: dict[str, str] = {}
        self._s030_module_aliases: set[str] = set()
        self._s030_uses: list[tuple[int, int, str, str]] = []
        # Module-level classes, indexed as encountered. A base is always defined
        # before its subclass at module level, so in-order indexing suffices.
        self._module_classes: dict[str, ast.ClassDef] = {}
        # {name : count of how many times `name` is bound at the module level} filled before the walk
        self._module_bindings: dict[str, int] = {}
        # { class name : its body's binding counts} filled when a lookup first needs them
        self._class_bindings: dict[str, dict[str, int]] = {}
        # one frame per block (if / else / loop / try / except body...) being visited in a function:
        # name -> what it was tracked as before the block reassigned it, so it can be restored after
        self._forget_frames: list[dict[str, tuple[bool, bool, str | None, bool]]] = []
        # publish_status of the enclosing module-level class, for S022.
        self._publish_status: dict[str, str] | None = None
        # Input rules: per-method accumulation, innermost last.
        self._input_stack: list[_InputCtx] = []
        # names of top level constants holding literal string keys, these keys are collected in visit_Module()
        self._literal_var_constants: set[str] = set()
        self._class_decorators: list[ast.expr] = []
        self._class_stack: list[str] = []
        self._function_stack: list[str] = []
        # scope -> ctx for every top-level function and method in the file,
        # i.e "Endpoint.get" or "function_name()", used to look a function up by name.
        # A scope defined twice (an if/else def, or @overload then the real def) keeps the last one
        self._functions: dict[str, _InputCtx] = {}
        # every ctx in file order, duplicates included, so a scope defined twice is reported twice
        self._function_ctxs: list[_InputCtx] = []
        # (rule, scope, key, position) already reported, so a shared helper's line is reported once
        self._reported_inputs: set[tuple[ApiRule, str, str, _StartEnd]] = set()

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module == _S030_LEGACY_MODULE and not node.level:
            for alias in node.names:
                if alias.name in _S030_LEGACY_NAMES:
                    local_name = alias.asname or alias.name
                    self._s030_legacy_names[local_name] = alias.name
                    self._s030_record(node, f"import {alias.name}")

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
            if alias.name == _S030_LEGACY_MODULE:
                if alias.asname:
                    self._s030_module_aliases.add(alias.asname)
                self._s030_record(node, f"import {alias.name}")
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
        elif isinstance(node.value, str) and node.value == _S030_LEGACY_ROUTE:
            self._s030_record(node, f"use {_S030_LEGACY_ROUTE}")

        self.generic_visit(node)

    def visit_arg(self, node: ast.arg) -> None:
        if node.arg == "monkeypatch":
            self.errors.append((node.lineno, node.col_offset, S014_msg))

        self.generic_visit(node)

    def visit_ExceptHandler(self, node: ast.ExceptHandler) -> None:
        self._except_vars.append(node.name)
        try:
            if node.type is not None:
                self.visit(node.type)
            forget = None
            if node.name:
                forget = [node.name]
            self._visit_block(node.body, forget)
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

    def visit_Module(self, node: ast.Module) -> None:
        """Visitor for tracking top level constant variables that hold request fields to iterate over."""
        self._literal_var_constants = _collect_literal_var_constants(tree=node)
        self._module_bindings = _scope_binding_counts(node.body)
        self.generic_visit(node)
        self._report_public_inputs()

    def _new_safe_loop_var(
        self, target: ast.expr, iter_node: ast.expr, curr_method: _InputCtx
    ) -> str | None:
        """The loop variable to mark safe when a loop iterates over a fixed set of keys, else None."""
        if not _is_iterable_elms_literals(
            node=iter_node,
            file_lvl_constants=self._literal_var_constants,
            declared_serializers=curr_method.declared_params | curr_method.declared_body,
        ):
            return None

        loop_var = _loop_var_name(target)

        # an outer loop already marked this loop variable name, but we need to leave it to the outer loop so
        # the inner loop reusing the name keeps the outer name safe
        if loop_var in curr_method.safe_loop_vars:
            return None

        return loop_var

    def _new_field_loop_var(
        self, target: ast.expr, iter_node: ast.expr, curr_method: _InputCtx
    ) -> tuple[str, str] | None:
        """(loop variable, serializer) for `for f in X().fields` when X isn't declared on this function.

        Only called when the loop isn't already safe. Whether X is declared is decided in the merge,
        against the public method's @extend_schema.
        """
        serializer = _fields_serializer(iter_node)
        if serializer is None:
            return None
        loop_var = _loop_var_name(target)
        if (
            loop_var is None
            or loop_var in curr_method.safe_loop_vars
            or loop_var in curr_method.field_loop_vars
        ):
            return None
        return loop_var, serializer

    def visit_For(self, node: ast.For) -> None:
        """Visitor for tracking looping variables declared within a for loop (i.e, `for X in (iterable collection)`, tracking X)"""

        if not self._input_stack:
            self.generic_visit(node)
            return

        curr_method = self._input_stack[-1]

        self.visit(node.target)
        self.visit(node.iter)

        loop_var = self._new_safe_loop_var(node.target, node.iter, curr_method)
        if loop_var is not None:
            curr_method.safe_loop_vars.add(loop_var)

        field_var = None
        if loop_var is None:
            field_var = self._new_field_loop_var(node.target, node.iter, curr_method)
            if field_var is not None:
                curr_method.field_loop_vars[field_var[0]] = field_var[1]

        loop_forget = None
        if not _touches_source(curr_method, node.iter):
            loop_forget = _target_names(node.target)
        self._visit_block(node.body, forget=loop_forget)

        if loop_var is not None:
            curr_method.safe_loop_vars.discard(loop_var)
        if field_var is not None:
            curr_method.field_loop_vars.pop(field_var[0], None)

        self._visit_block(node.orelse)

    def visit_comprehension_types(
        self, node: ast.ListComp | ast.DictComp | ast.SetComp | ast.GeneratorExp
    ) -> None:
        """Visitor for tracking loop variables in list, set, dict and generator comprehensions."""

        if not self._input_stack:
            self.generic_visit(node)
            return

        curr_method = self._input_stack[-1]

        valid_vars: list[str] = []
        field_vars: list[str] = []

        for comp_node in node.generators:
            self.visit(comp_node.iter)
            self.visit(comp_node.target)

            loop_var = self._new_safe_loop_var(comp_node.target, comp_node.iter, curr_method)
            if loop_var is not None:
                curr_method.safe_loop_vars.add(loop_var)
                valid_vars.append(loop_var)
            else:
                field_var = self._new_field_loop_var(comp_node.target, comp_node.iter, curr_method)
                if field_var is not None:
                    curr_method.field_loop_vars[field_var[0]] = field_var[1]
                    field_vars.append(field_var[0])

            for condition in comp_node.ifs:
                self.visit(condition)

        if isinstance(node, ast.DictComp):
            self.visit(node.key)
            self.visit(node.value)
        else:
            self.visit(node.elt)

        for var in valid_vars:
            curr_method.safe_loop_vars.discard(var)
        for var in field_vars:
            curr_method.field_loop_vars.pop(var, None)

    visit_ListComp = visit_SetComp = visit_GeneratorExp = visit_DictComp = visit_comprehension_types

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
        self._visit_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._visit_function(node)

    def _visit_function(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        if len(self._class_stack) == 1 and self._function_depth == 0:
            self._check_S021(node)
            self._check_S022(node)
            self._check_S034(node)
        ctx = self._new_input_ctx(node)
        self._function_depth += 1
        self._function_stack.append(node.name)
        pushed = False
        try:
            # decorators, defaults and annotations run outside the function body, so they're
            # visited before its ctx is pushed, so reads and calls in @extend_schema(...) don't count as the function's
            for decorator in node.decorator_list:
                self.visit(decorator)
            self.visit(node.args)
            if node.returns is not None:
                self.visit(node.returns)
            for type_param in node.type_params:
                self.visit(type_param)
            if ctx is not None:
                self._input_stack.append(ctx)
                pushed = True
            if pushed:
                for statement in node.body:
                    self.visit(statement)
            else:
                # a nested def shares the outer function's ctx, so its reassignments end with it
                self._visit_block(node.body)
        finally:
            self._function_stack.pop()
            self._function_depth -= 1
            if pushed and ctx is not None:
                self._input_stack.pop()
                ctx.node = node
                self._functions[ctx.scope] = ctx
                self._function_ctxs.append(ctx)

    def visit_Lambda(self, node: ast.Lambda) -> None:
        self._function_depth += 1
        try:
            self.generic_visit(node)
        finally:
            self._function_depth -= 1

    def visit_Assign(self, node: ast.Assign) -> None:
        if _is_seer_connection_pool_call(node.value):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    self._s029_seer_pool_names.add(target.id)
        # names reassigned to something that isn't request input. The names are forgotten after the value is
        # visited, so a read in the value itself (`data = data.get("field")`) still counts
        to_forget: list[str] = []
        if self._input_stack:
            ctx = self._input_stack[-1]
            # a value built from request input may still be client input, so nothing is forgotten
            keeps_input = _touches_source(ctx, node.value)
            for target in node.targets:
                if not isinstance(target, ast.Name):
                    if not keeps_input:
                        to_forget.extend(_target_names(target))
                    continue
                if ctx.is_query(node.value):
                    self._forget(ctx, target.id)
                    ctx.query_locals.add(target.id)
                elif ctx.is_body(node.value):
                    self._forget(ctx, target.id)
                    ctx.body_locals.add(target.id)
                else:
                    # `q = params`, `r = req` or `q = req.GET` alias one of the function's params
                    placeholder = ctx.param_source_of(node.value)
                    if placeholder is not None:
                        self._forget(ctx, target.id)
                        ctx.param_locals[target.id] = placeholder
                        ctx.rebound_names.discard(target.id)
                    elif not keeps_input:
                        to_forget.append(target.id)
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
        self._check_S031(node.targets)
        self._check_S033(node.targets)
        self.generic_visit(node)
        self._forget_names(to_forget)

    def _forget_names(self, names: list[str]) -> None:
        """Stops treating each of `names` as request input in the current function, if there is one.
        `names` the names that were just reassigned
        Returns nothing
        """
        if not self._input_stack:
            return
        for name in names:
            self._forget(self._input_stack[-1], name)

    def _forget(self, ctx: _InputCtx, name: str) -> None:
        """Forget `name` in `ctx`, first noting what it was in the innermost block, so the block can
        put it back when it ends.
        `ctx` the function being visited
        `name` the name being reassigned
        Returns nothing
        """
        if self._forget_frames and name not in self._forget_frames[-1]:
            self._forget_frames[-1][name] = (
                name in ctx.query_locals,
                name in ctx.body_locals,
                ctx.param_locals.get(name),
                name in ctx.rebound_names,
            )
        ctx.forget_request(name)

    def _visit_block(self, statements: list[ast.stmt], forget: list[str] | None = None) -> None:
        """Visit one block of statements (an if or else body, a loop body, a try or except body...).

        A reassignment inside the block only applies to the reads after it in the same block. When
        the block ends, each name it reassigned is put back to what it was before, on top of anything
        the block added, since code after the block may run without the reassignment having happened.
        `statements` the block's statements
        `forget` names bound when the block starts, like an `except ... as e` name
        Returns nothing
        """
        if not self._input_stack:
            for statement in statements:
                self.visit(statement)
            return
        ctx = self._input_stack[-1]
        self._forget_frames.append({})
        try:
            if forget:
                self._forget_names(forget)
            for statement in statements:
                self.visit(statement)
        finally:
            frame = self._forget_frames.pop()
        for name, (was_query, was_body, placeholder, was_rebound) in frame.items():
            if was_query:
                ctx.query_locals.add(name)
            if was_body:
                ctx.body_locals.add(name)
            if placeholder is not None and name not in ctx.param_locals:
                ctx.param_locals[name] = placeholder
            if not was_rebound:
                ctx.rebound_names.discard(name)

    def generic_visit(self, node: ast.AST) -> None:
        """Same as ast.NodeVisitor's, except that inside a function each list of statements is
        visited as a block (see _visit_block)."""
        if not self._input_stack:
            super().generic_visit(node)
            return
        for _field, value in ast.iter_fields(node):
            if isinstance(value, list):
                if value and isinstance(value[0], ast.stmt):
                    self._visit_block(value)
                    continue
                for item in value:
                    if isinstance(item, ast.AST):
                        self.visit(item)
            elif isinstance(value, ast.AST):
                self.visit(value)

    def visit_With(self, node: ast.With) -> None:
        self._visit_with(node)

    def visit_AsyncWith(self, node: ast.AsyncWith) -> None:
        self._visit_with(node)

    def _visit_with(self, node: ast.With | ast.AsyncWith) -> None:
        """`with xyz as data:` rebinds data before the body runs"""
        for item in node.items:
            self.visit(item)
            if item.optional_vars is not None and not (
                self._input_stack and _touches_source(self._input_stack[-1], item.context_expr)
            ):
                self._forget_names(_target_names(item.optional_vars))
        for statement in node.body:
            self.visit(statement)

    def visit_AugAssign(self, node: ast.AugAssign) -> None:
        self._check_S031([node.target])
        self._check_S033([node.target])
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        self._check_S031([node.target])
        self._check_S033([node.target])
        self.generic_visit(node)
        if (
            node.value is not None
            and self._input_stack
            and not _touches_source(self._input_stack[-1], node.value)
        ):
            self._forget_names(_target_names(node.target))

    def visit_Delete(self, node: ast.Delete) -> None:
        self._check_S031(node.targets)
        self.generic_visit(node)

    def _check_S031(self, targets: list[ast.expr]) -> None:
        if not _is_tests_path(self.filename):
            return
        for target in targets:
            if _is_settings_target(target):
                self.errors.append((target.lineno, target.col_offset, S031_msg))

    def _s033_applies(self) -> bool:
        # set_request_principal is the one setter; tests may assign directly.
        return not _is_tests_path(self.filename) and not self.filename.endswith(
            "sentry/auth/principal.py"
        )

    def _check_S033(self, targets: list[ast.expr]) -> None:
        if not self._s033_applies():
            return
        for target in _unpack_targets(targets):
            if _is_request_principal_attr(target):
                self.errors.append((target.lineno, target.col_offset, S033_msg))

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
        if self._publish_status.get(node.name.upper()) not in PUBLISHED_STATUSES:
            return
        if node.returns is None:
            self.errors.append((node.lineno, node.col_offset, S022_missing_msg))
        elif _annotation_has_bare_response(node.returns):
            self.errors.append((node.lineno, node.col_offset, S022_bare_msg))

    def _check_S034(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        """A 4xx that the method returns inline must be a key in `responses=`.

        Only `return Response(..., status=...)` written in the method itself, with a
        literal or `status.HTTP_4xx_*` status, is checked. A 4xx that comes from a
        helper's return value, a response built into a variable first, or a raised
        exception (DRF renders `APIException`s) is not seen, so passing this rule
        does not mean every 4xx is documented."""
        documented = _documented_statuses(node.decorator_list)
        if documented is None:
            return
        for call, code in _inline_response_statuses(node):
            if 400 <= code < 500 and code not in documented:
                self.errors.append((call.lineno, call.col_offset, S034_msg.format(code)))

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
                elif kw.arg in ("omit_from_public_schema", "deprecate"):
                    self._check_paths(dec, kw, fields, open_class)

    def _check_paths(
        self, dec: ast.Call, kw: ast.keyword, fields: set[str], open_class: bool
    ) -> None:
        """Reasons and grammar for a {path: reason} mapping.

        Only the first segment is a field here; the schema build resolves the rest."""
        if not isinstance(kw.value, ast.Dict):
            self.errors.append((dec.lineno, dec.col_offset, S023_not_mapping_msg))
            return
        assert kw.arg is not None
        for k, v in zip(kw.value.keys, kw.value.values):
            if not isinstance(k, ast.Constant) or not isinstance(k.value, str):
                continue
            path = k.value
            segments = path.split(".")
            if any(not segment.strip() for segment in segments):
                self.errors.append(
                    (dec.lineno, dec.col_offset, S023_bad_path_msg.format(kw.arg, path))
                )
                continue
            reason = _joined_str(v)
            if reason is not None and not reason.strip():
                self.errors.append((dec.lineno, dec.col_offset, S023_blank_reason_msg.format(path)))
            if not open_class and segments[0] not in fields:
                self.errors.append(
                    (dec.lineno, dec.col_offset, S023_ghost_msg.format(kw.arg, segments[0]))
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

    def _s030_record(self, node: ast.stmt | ast.expr, kind: str) -> None:
        function = self._function_stack[-1] if self._function_stack else _S030_MODULE_SCOPE
        self._s030_uses.append((node.lineno, node.col_offset, function, kind))

    def _s030_call_name(self, node: ast.expr) -> str | None:
        if isinstance(node, ast.Name):
            return self._s030_legacy_names.get(node.id)

        qualified = _name_of(node)
        for legacy_name in _S030_LEGACY_NAMES:
            if qualified == f"{_S030_LEGACY_MODULE}.{legacy_name}":
                return legacy_name
            if any(qualified == f"{alias}.{legacy_name}" for alias in self._s030_module_aliases):
                return legacy_name
        return None

    def visit_Subscript(self, node: ast.Subscript) -> None:
        # Load only: `request.data["title"] = ...` writes a value, it does not
        # read a parameter the client sent.
        if self._input_stack and isinstance(node.ctx, ast.Load):
            ctx = self._input_stack[-1]
            source = ctx.source_of(node.value)
            if source is not None:
                ctx.record_read(node.slice, source, node)
        self.generic_visit(node)

    def _new_input_ctx(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> _InputCtx | None:
        """Build the accumulator for a top-level function or a method of a top-level class, else None.

        Only PUBLIC HTTP methods are reported, every other ctx is a helper whose
        "facts" get merged into the public methods that call it. The caller pushes it
        onto _input_stack once the decorators and arguments have been visited.
        """
        if self._function_depth != 0:
            return None

        if not self._class_stack:
            ctx = _InputCtx(node.name, set(), set(), is_public=False)
            ctx.params = _function_params(node)
            return ctx

        if len(self._class_stack) != 1:
            return None

        is_public = bool(
            self._publish_status
            and node.name in HTTP_METHODS
            and self._publish_status.get(node.name.upper()) == "PUBLIC"
        )

        declared_params: set[str] = set()
        declared_body: set[str] = set()

        if is_public:
            decorators = self._class_decorators + node.decorator_list
            declared_params = _declared_names(decorators, "parameters")
            declared_body = _declared_names(decorators, "request")

        ctx = _InputCtx(
            f"{self._class_stack[-1]}.{node.name}",
            declared_params,
            declared_body,
            is_public=is_public,
            class_name=self._class_stack[-1],
        )
        ctx.params = _function_params(node)
        ctx.is_static = _is_staticmethod(node)
        return ctx

    def _record_input_call(self, node: ast.Call) -> None:
        """A `.get()` read, or the whole dict handed to something else."""
        ctx = self._input_stack[-1]
        func = node.func
        if isinstance(func, ast.Attribute) and func.attr in _READ_METHODS:
            source = ctx.source_of(func.value)
            if source is not None and node.args:
                ctx.record_read(node.args[0], source, node)
            # On anything but the request this is an ordinary lookup, and
            # `options.get("k", request.GET)` passes a default, not the dict.
            return
        # Only a serializer's data= is the target shape. This includes uppercase class
        # names, and lowercase names or attributes whose last part ends in `_cls`,
        # `serializer` or `validator` (serializer_cls, self.get_serializer, settings.validator).
        # `my_func(data=...)` hands the dict over exactly as a positional argument would.
        # Known limit: a plain function that happens to end in one of those suffixes, like
        # run_validator(data=...), is exempt too. The variable check is kept separate from
        # `_looks_like_a_class` because `_looks_like_a_class` has two callers and only this
        # specific check should be expanded.
        if (_looks_like_a_class(func) or _looks_like_a_class_variable(func)) and any(
            kw.arg == "data" for kw in node.keywords
        ):
            return
        name = _name_of(func).rsplit(".", 1)[-1]
        if name in _CONTAINER_OPS:
            return
        # The first real source, as before, plus one hand-off for every parameter placeholder.
        # A placeholder only becomes an S028 if the merge finds the parameter received a payload,
        # so `serialize(organization, request.GET)` still reports the query string, and in a helper
        # `serialize(params, request.GET)` keeps both. The date-range exemption is checked at report time.
        recorded_real = False
        for argument in [*node.args, *(keyword.value for keyword in node.keywords)]:
            source = ctx.source_of(argument)
            if source is None:
                continue
            if source.startswith(_PARAM_PREFIX):
                ctx.hand_offs.append((_start_and_end(node), name, source))
            elif not recorded_real:
                ctx.hand_offs.append((_start_and_end(node), name, source))
                recorded_real = True

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
                ctx.query_validators.append((_start_and_end(node), name))
            elif ctx.is_body(keyword.value):
                ctx.body_validators.append((_start_and_end(node), name))
            else:
                placeholder = ctx.param_source_of(keyword.value)
                if placeholder is not None:
                    ctx.param_validators.append((_start_and_end(node), name, placeholder))

    def _report_input(
        self,
        ctx: _InputCtx,
        start_end: _StartEnd,
        msg: str,
        group: str,
        key: str,
        source: str,
        rule: ApiRule,
        scope: str | None = None,
    ) -> None:
        """Always recorded as a structured violation; fatal only for an enforced group.

        `scope` is where the finding is, when that isn't `ctx` itself (a read inside a helper). A helper
        reached from several public methods is reported once, the first time (in file order).
        """
        enforced = group in ENFORCED
        where = scope or ctx.scope
        prefixed_key = f"{_SOURCE_PREFIX[source]}:{key}"
        # a shared helper's line is one finding, however many public methods reach it
        identity = (rule, where, prefixed_key, start_end)
        if identity in self._reported_inputs:
            return
        self._reported_inputs.add(identity)
        caller = None
        if where != ctx.scope:
            caller = ctx.scope
        self.api_violations.append(
            ApiInputViolation(
                rule=rule,
                message=msg,
                line=start_end.line,
                column=start_end.column,
                end_line=start_end.end_line,
                end_column=start_end.end_column,
                severity="error" if enforced else "warning",
                scope=where,
                key=prefixed_key,
                caller=caller,
            )
        )
        if enforced or os.environ.get(INPUT_LINT_ALL_ENV):
            self.errors.append((start_end.line, start_end.column, msg))

    def _report_public_inputs(self) -> None:
        """Report input reads and hand-offs for each public endpoint method after traversing through the complete file"""
        for http_ctx in self._function_ctxs:
            if not http_ctx.is_public:
                continue
            # the HTTP method's own facts plus those of every same-file helper it reaches
            ctx = self._merged_http_method_inputs(http_ctx)
            for start_end, name in ctx.query_validators:
                if name not in ctx.declared_params:
                    msg = S025_query_msg.format(name)
                    self._report_input(
                        ctx, start_end, msg, "declared", name, "query string", ApiRule.S025
                    )
            for start_end, name in ctx.body_validators:
                if name not in ctx.declared_body:
                    msg = S025_body_msg.format(name)
                    self._report_input(
                        ctx, start_end, msg, "declared", name, "request body", ApiRule.S025
                    )
            # S026-S028 are reported where the read or hand-off is, so a helper's line is one finding.
            # S025 above stays on the public method, since it depends on that method's @extend_schema
            for start_end, key, source in ctx.literal_reads:
                msg = S026_msg.format(repr(key), source)
                self._report_input(
                    ctx,
                    start_end,
                    msg,
                    "shaped",
                    key,
                    source,
                    ApiRule.S026,
                    ctx.found_in.get(start_end),
                )
            for start_end, key, source in ctx.computed_reads:
                msg = S027_msg.format(source, key)
                self._report_input(
                    ctx,
                    start_end,
                    msg,
                    "shaped",
                    key,
                    source,
                    ApiRule.S027,
                    ctx.found_in.get(start_end),
                )
            for start_end, callee, source in ctx.hand_offs:
                # The date helpers read a fixed set of keys, so they are only a hand-off
                # when the endpoint does not document all of them.
                if callee in _DATE_RANGE_HELPERS and _DATE_RANGE_PARAMS.issubset(
                    ctx.declared_params
                ):
                    continue
                msg = S028_msg.format(source, callee)
                self._report_input(
                    ctx,
                    start_end,
                    msg,
                    "shaped",
                    callee,
                    source,
                    ApiRule.S028,
                    ctx.found_in.get(start_end),
                )

    def _request_payload_input(self, ctx: _InputCtx, argument: ast.expr) -> str | None:
        """Returns what request input the argument carries: "request", "query string", "request body", or None"""
        if _is_request(argument):
            return "request"
        return ctx.source_of(argument)

    def _get_kind_of_helper(self, node: ast.Call) -> tuple[Kind | None, str | None]:
        """Returns the "kind" of helper function and its name, or (None, None) if the call isn't a helper shape"""

        func = node.func
        kind = None
        name = None

        # a helper method, i.e. self.helper()
        if (
            isinstance(func, ast.Attribute)
            and isinstance(func.value, ast.Name)
            and func.value.id == "self"
        ):
            kind = Kind.CLASS_METHOD
            name = func.attr

        # a parent class method, i.e. super().helper()
        elif (
            isinstance(func, ast.Attribute)
            and isinstance(func.value, ast.Call)
            and isinstance(func.value.func, ast.Name)
            and func.value.func.id == "super"
        ):
            kind = Kind.PARENT_CLASS_METHOD
            name = func.attr

        # a plain function, i.e. helper(). The inner super() of super().helper() isn't one
        elif isinstance(func, ast.Name) and func.id != "super":
            kind = Kind.NORMAL_FUNCTION
            name = func.id

        return (kind, name)

    def _record_helper(self, node: ast.Call) -> None:
        """Record a call to a possible helper and which arguments carry request input."""

        # what kind of helper it is, and its name
        kind, name = self._get_kind_of_helper(node)

        if kind is None or name is None:
            return

        curr_ctx = self._input_stack[-1]

        # [(arg index or keyword name, the request input it carries), ...]
        request_params: list[tuple[int | str, str]] = []
        # *args or **kwargs can forward anything so a call that has them is unresolved
        starred = False

        for index, argument in enumerate(node.args):
            # *args can't be matched to a param and positions after it are unknown so we need to avoid this
            if isinstance(argument, ast.Starred):
                starred = True
                break
            request_payload = self._request_payload_input(curr_ctx, argument)
            if request_payload is not None:
                request_params.append((index, request_payload))

        for keyword in node.keywords:
            # **kwargs has no name to match
            if keyword.arg is None:
                starred = True
                continue
            request_payload = self._request_payload_input(curr_ctx, keyword.value)
            if request_payload is not None:
                request_params.append((keyword.arg, request_payload))

        # recorded even when nothing is passed since the helper can still read self.request
        curr_ctx.calls.append(
            _HelperCall(kind, name, request_params, starred, _start_and_end(node))
        )

    def _helper_call_ctx_lookup(
        self, helper_call: _HelperCall, endpoint_class: str, helper_defined_class: str | None
    ) -> _InputCtx | Literal["UNRESOLVED"] | None:
        """Return the ctx of the same-file function that `helper_call` runs.

        `endpoint_class` is the endpoint class the helper was called in.
        `helper_defined_class` is the class that defines the helper function making the `helper_call`.

        Returns None if the name isn't defined in this file, and _UNRESOLVED if the lookup reaches a class from another file before finding the method.
        """
        if helper_call.kind == Kind.NORMAL_FUNCTION:
            # a name bound more than once (two defs, or a def then `helper = xyz`) could be either
            if self._module_bindings.get(helper_call.name, 0) != 1:
                return None
            return self._functions.get(helper_call.name)

        order = self._handle_inheritance_method_lookup(public_class=endpoint_class)
        if helper_call.kind == Kind.PARENT_CLASS_METHOD:
            if helper_defined_class not in order:
                return None
            start = order.index(helper_defined_class)
            # which class super() continues with depends on the whole tree below it
            for cls in order[: start + 1]:
                if self._is_ambiguous_class(cls):
                    return _UNRESOLVED
            order = order[start + 1 :]

        for cls in order:
            if cls not in self._module_classes or self._module_bindings.get(cls, 0) != 1:
                return _UNRESOLVED
            bound = self._class_binding_count(cls, helper_call.name)
            if bound == 1:
                ctx = self._functions.get(f"{cls}.{helper_call.name}")
                # bound once, but not by a def (i.e, `h = external_h`)
                if ctx is None:
                    return _UNRESOLVED
                return ctx
            if bound > 1:
                return _UNRESOLVED
            # past this class the depth-first order may not be the real method order so we need to check if it's an ambiguous class
            if self._is_ambiguous_class(cls):
                return _UNRESOLVED

        return None

    def _class_binding_count(self, cls: str, name: str) -> int:
        """How many times `name` is bound directly in the body of the module-level class `cls`."""
        if cls not in self._class_bindings:
            self._class_bindings[cls] = _scope_binding_counts(self._module_classes[cls].body)
        return self._class_bindings[cls].get(name, 0)

    def _is_ambiguous_class(self, cls: str) -> bool:
        """Whether `cls` has more than one base from this file, so the classes after it in the
        depth-first walk may not be in Python's real method order (a diamond, for example)."""
        class_node = self._module_classes.get(cls)
        if class_node is None:
            return False
        same_file = 0
        for base in class_node.bases:
            if _name_of(base) in self._module_classes:
                same_file += 1
        return same_file > 1

    def _handle_inheritance_method_lookup(self, public_class: str) -> list[str]:
        """Returns class names in depth-first method lookup order starting from `public_class` all the way up to its parents to deal with inheritance.
        `public_class` the starting endpoint class name whose inheritance chain is being searched

        Class Grandfather()

        Class Father(Grandfather)

        Class Child(Father)

        _handle_inheritance_method_lookup("Child") -> ["Child", "Father", "Grandfather"]

        A super() call starts after the class that made it, which _helper_call_ctx_lookup handles.
        """
        order: list[str] = []
        self._walk_class_bases(name=public_class, visited=set(), order=order)
        return order

    def _walk_class_bases(self, name: str, visited: set[str], order: list[str]) -> None:
        """Appends `name` and each of its bases depth first, left to right, and each class once.
        `name` the name of the current class being visited in the inheritance tree
        `visited` set of class names already seen during the walk
        `order` list that collects class names in depth first, left to right lookup order as the recursion walks up the parents
        """
        if name in visited:
            return
        visited.add(name)
        order.append(name)

        class_node = self._module_classes.get(name)
        if class_node is None:
            return

        for base in class_node.bases:
            base_name = _name_of(base)
            if base_name != "object":
                self._walk_class_bases(base_name, visited, order)

    def _merged_http_method_inputs(self, http_ctx: _InputCtx) -> _InputCtx:
        """Return a new ctx with `http_ctx`'s own facts plus those of every same-file helper it reaches.
        Stored ctxs are never changed, so a helper shared by two public methods is merged into each separately.
        _report_public_inputs() runs S025-S028 on the result, so reads inside helpers are reported under the HTTP method's `http_ctx`.
        """
        assert http_ctx.class_name is not None  # to satisfy mypy

        # create the ctx based off of the http method (its our ctx that will hold everything the http method ctx holds + the helpers ctx holds)
        new_ctx = _InputCtx(
            scope=http_ctx.scope,
            declared_params=http_ctx.declared_params,
            declared_body=http_ctx.declared_body,
            is_public=True,
            class_name=http_ctx.class_name,
        )

        # the HTTP method's own reads are already real sources, so it starts with no bindings
        self._merge_ctx_into(
            new_ctx=new_ctx,
            ctx=http_ctx,
            seen={(http_ctx.scope, frozenset())},
            bindings={},
        )

        return new_ctx

    def _bind_call(
        self, call: _HelperCall, target: _InputCtx, caller_bindings: dict[str, str]
    ) -> tuple[dict[str, str], bool]:
        """What each of `target`'s parameters received from `call`, in real terms
        ("request" / "query string" / "request body"), and whether every payload found a named parameter.

        A payload that lands past the positional parameters, on a keyword the def doesn't have, or in
        *args / **kwargs can't be tied to a name, so the call isn't fully bound and its S028 stays.
        """
        positional = target.params.positional
        # self.X() and super().X() fill self (or cls) themselves, unless the target is a @staticmethod
        if call.kind != Kind.NORMAL_FUNCTION and not target.is_static:
            positional = positional[1:]

        bindings: dict[str, str] = {}
        all_bound = True
        for where, what in call.passes:
            # what the caller passed, resolved with the caller's own bindings
            real = _resolve_source(what, caller_bindings, for_binding=True)
            # not request input for this caller, i.e organization
            if real is None:
                continue
            if isinstance(where, int):
                if where >= len(positional):
                    all_bound = False
                    continue
                bindings[positional[where]] = real
            else:
                if where not in target.params.keyword:
                    all_bound = False
                    continue
                bindings[where] = real
        return bindings, all_bound

    def _merge_ctx_into(
        self,
        new_ctx: _InputCtx,
        ctx: _InputCtx,
        seen: set[tuple[str, frozenset[tuple[str, str]]]],
        bindings: dict[str, str],
    ) -> None:
        """Copies `ctx`'s facts (i.e. `literal_reads`, `hand_offs`, `computed_reads`) into `new_ctx`, then do the same for each same-file helper
        `ctx` calls.
        `seen` holds (scope, bindings) already copied into `new_ctx` for this HTTP method, starting with its own, so the same
        helper called with different inputs is still followed.
        `bindings` is what each of `ctx`'s parameters received, used to turn its placeholders into real sources.
        """
        assert new_ctx.class_name is not None  # satisfying mypy

        # positions of calls whose helper was followed with every payload so their S028 hand-off is dropped
        followed: set[_StartEnd] = set()

        # (helper ctx, what its parameters received) to merge next
        to_visit: list[tuple[_InputCtx, dict[str, str]]] = []

        # loop over all the helper calls this function makes
        for call in ctx.calls:
            if call.starred:
                continue
            # `helper()` in a function with its own `helper` (a parameter, import, nested def, etc) but it may
            # not be the module-level one
            if call.kind == Kind.NORMAL_FUNCTION and _binds_name(ctx, call.name):
                continue

            # gets the ctx of the helper
            helper_ctx = self._helper_call_ctx_lookup(
                helper_call=call,
                endpoint_class=new_ctx.class_name,
                helper_defined_class=ctx.class_name,
            )

            # skip it unless it's a helper in the same file (None = not in this file, _UNRESOLVED = reached another file)
            if not isinstance(helper_ctx, _InputCtx):
                continue

            helper_bindings, all_bound = self._bind_call(call, helper_ctx, bindings)
            # a payload that couldn't be tied to a parameter, or that can leave the helper unseen
            # (i.e `return params`), keeps its S028
            if all_bound and not _leaks_a_payload(helper_ctx, helper_bindings):
                followed.add(call.at)

            to_visit.append((helper_ctx, helper_bindings))

        # copy the facts over, turning placeholders into real sources and dropping the ones that don't resolve
        for start_end, name in ctx.query_validators:
            _append_once(new_ctx.query_validators, (start_end, name))
        for start_end, name in ctx.body_validators:
            _append_once(new_ctx.body_validators, (start_end, name))
        for start_end, name, placeholder in ctx.param_validators:
            real = _resolve_source(placeholder, bindings)
            if real == "query string":
                _append_once(new_ctx.query_validators, (start_end, name))
            elif real == "request body":
                _append_once(new_ctx.body_validators, (start_end, name))
        for start_end, key, source in ctx.literal_reads:
            real = _resolve_source(source, bindings)
            if real is not None:
                _append_once(new_ctx.literal_reads, (start_end, key, real))
                new_ctx.found_in[start_end] = ctx.scope
        for start_end, key, source in ctx.computed_reads:
            real = _resolve_source(source, bindings)
            if real is not None:
                _append_once(new_ctx.computed_reads, (start_end, key, real))
                new_ctx.found_in[start_end] = ctx.scope
        # a loop over X().fields reads a fixed set of keys when the public method declares X
        for start_end, key, source, serializer in ctx.field_reads:
            if serializer in new_ctx.declared_params or serializer in new_ctx.declared_body:
                continue
            real = _resolve_source(source, bindings)
            if real is not None:
                _append_once(new_ctx.computed_reads, (start_end, key, real))
                new_ctx.found_in[start_end] = ctx.scope
        for start_end, callee, source in ctx.hand_offs:
            if start_end in followed:
                continue
            real = _resolve_source(source, bindings)
            if real is not None:
                _append_once(new_ctx.hand_offs, (start_end, callee, real))
                new_ctx.found_in[start_end] = ctx.scope

        for helper_ctx, helper_bindings in to_visit:
            seen_key = (helper_ctx.scope, frozenset(helper_bindings.items()))
            if seen_key in seen:
                continue

            seen.add(seen_key)
            self._merge_ctx_into(
                new_ctx=new_ctx, ctx=helper_ctx, seen=seen, bindings=helper_bindings
            )

    def visit_Call(self, node: ast.Call) -> None:
        self._s024_visit_call(node)
        if legacy_name := self._s030_call_name(node.func):
            self._s030_record(node, f"call {legacy_name}")
        if isinstance(node.func, ast.Attribute) and node.func.attr == "urlopen":
            self._s029_urlopen_calls.append(
                (node.lineno, node.col_offset, _name_of(node.func.value))
            )
        if self._input_stack:
            self._record_validator(node)
            self._record_input_call(node)
            self._record_helper(node)
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

        # S033: setattr(request, "user" | "auth", ...).
        if (
            isinstance(node.func, ast.Name)
            and node.func.id == "setattr"
            and len(node.args) >= 2
            and isinstance(node.args[1], ast.Constant)
            and node.args[1].value in ("user", "auth")
            and self._s033_applies()
            and _is_named_request(node.args[0])
        ):
            self.errors.append((node.lineno, node.col_offset, S033_msg))

        # S032: a caller's possibly-None user_id used as a queryset lookup.
        if (
            isinstance(node.func, ast.Attribute)
            and node.func.attr in _S032_query_methods
            and ".objects" in _name_of(node.func.value)
        ):
            for keyword in node.keywords:
                if _is_acting_user_id(keyword.value):
                    self.errors.append((keyword.lineno, keyword.col_offset, S032_msg))

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


def get_api_violations(
    tree: ast.AST, filename: str, all_rules: bool = True
) -> list[ApiInputViolation]:
    """Scan a file's AST and keep structured records for S025-S028 violations.

    Unlike flake8's plain text output, these records preserve the method scope
    and parameter key needed for baseline tracking. By default `all_rules=True`,
    this returns every violation even if the rule is currently disabled in flake8.
    """
    visitor = SentryVisitor(filename, datetime.now(timezone.utc).year, _s015_msg())
    visitor.visit(tree)
    violations = []
    for violation in visitor.api_violations:
        if all_rules or violation.severity == "error":
            violations.append(violation)
    return violations


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
        yield from self._s029(visitor)
        yield from self._s030(visitor)

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

    def _s029(self, visitor: SentryVisitor) -> Generator[tuple[int, int, str, type[Any]]]:
        for line, col, receiver in visitor._s029_urlopen_calls:
            if receiver in visitor._s029_seer_pool_names:
                yield (line, col, S029_msg, type(self))

    def _s030(self, visitor: SentryVisitor) -> Generator[tuple[int, int, str, type[Any]]]:
        rel = _repo_relative(self.filename)
        if not rel.startswith("src/sentry/") or rel == "src/sentry/seer/signed_seer_api.py":
            return

        allowed = S030_allowlist.get(rel, {})
        seen: Counter[tuple[str, str]] = Counter()
        for line, col, function, kind in visitor._s030_uses:
            key = (function, kind)
            seen[key] += 1
            if seen[key] > allowed.get(key, 0):
                yield (line, col, S030_msg, type(self))

        for key, expected_count in allowed.items():
            if seen[key] < expected_count:
                function, kind = key
                yield (1, 0, S030_stale_msg.format(kind, function), type(self))
