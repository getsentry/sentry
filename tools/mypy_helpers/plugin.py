from __future__ import annotations

import functools
import json
import os
from collections.abc import Callable
from typing import Any, TypeVar

from mypy.build import PRI_MYPY
from mypy.errorcodes import ATTR_DEFINED
from mypy.messages import format_type
from mypy.nodes import (
    ARG_POS,
    AssignmentStmt,
    CallExpr,
    Decorator,
    DictExpr,
    Expression,
    FuncDef,
    IndexExpr,
    ListExpr,
    MemberExpr,
    MypyFile,
    NameExpr,
    ReturnStmt,
    StrExpr,
    TupleExpr,
    TypeInfo,
)
from mypy.options import Options
from mypy.plugin import (
    AttributeContext,
    ClassDefContext,
    FunctionContext,
    FunctionSigContext,
    MethodContext,
    MethodSigContext,
    Plugin,
    SemanticAnalyzerPluginInterface,
)
from mypy.plugins.common import add_attribute_to_class
from mypy.subtypes import find_member
from mypy.subtypes import is_subtype as _is_subtype
from mypy.typeanal import make_optional_type
from mypy.types import (
    AnyType,
    CallableType,
    FunctionLike,
    Instance,
    NoneType,
    Type,
    TypedDictType,
    TypeOfAny,
    UnionType,
    get_proper_type,
)

from tools.flake8_plugin import ENFORCED, INPUT_PATTERNS, KNOWN_QUERY_HELPERS


def _make_using_required_str(ctx: FunctionSigContext) -> CallableType:
    sig = ctx.default_signature

    using_arg = sig.argument_by_name("using")
    if using_arg is None or using_arg.pos is None:
        ctx.api.fail("The using parameter is required", ctx.context)
        return sig

    for kind in sig.arg_kinds[: using_arg.pos]:
        if kind != ARG_POS:
            ctx.api.fail("Expected using to be the first optional", ctx.context)
            return sig

    str_type = ctx.api.named_generic_type("builtins.str", [])
    arg_kinds = [*sig.arg_kinds[: using_arg.pos], ARG_POS, *sig.arg_kinds[using_arg.pos + 1 :]]
    arg_types = [*sig.arg_types[: using_arg.pos], str_type, *sig.arg_types[using_arg.pos + 1 :]]
    return sig.copy_modified(arg_kinds=arg_kinds, arg_types=arg_types)


def replace_transaction_atomic_sig_callback(ctx: FunctionSigContext) -> CallableType:
    sig = ctx.default_signature

    if not sig.argument_by_name("using"):
        # No using arg in the signature, bail
        return sig

    # We care about context managers.
    if not isinstance(sig.ret_type, Instance):
        return sig

    return _make_using_required_str(ctx)


_FUNCTION_SIGNATURE_HOOKS = {
    "django.db.transaction.atomic": replace_transaction_atomic_sig_callback,
    "django.db.transaction.get_connection": _make_using_required_str,
    "django.db.transaction.on_commit": _make_using_required_str,
    "django.db.transaction.set_rollback": _make_using_required_str,
}


def _modify_base_cache_version_type(ctx: MethodSigContext) -> FunctionLike:
    if "version" not in ctx.default_signature.arg_names:
        return ctx.default_signature

    types = list(ctx.default_signature.arg_types)
    types[ctx.default_signature.arg_names.index("version")] = AnyType(TypeOfAny.explicit)
    return ctx.default_signature.copy_modified(types)


def _remove_base_cache_decr_incr(ctx: MethodContext) -> Type:
    ctx.api.fail("removed method", ctx.context)
    return ctx.default_return_type


_AUTH_TOKEN_TP = "sentry.auth.services.auth.model.AuthenticatedToken"


def _has_symbols(api: SemanticAnalyzerPluginInterface, *symbols: str) -> bool:
    for symbol in symbols:
        if not api.lookup_fully_qualified_or_none(symbol):
            return False
    else:
        return True


def _request_auth_tp(api: SemanticAnalyzerPluginInterface) -> Type:
    st = api.lookup_fully_qualified(_AUTH_TOKEN_TP)
    assert isinstance(st.node, TypeInfo), st.node
    return make_optional_type(Instance(st.node, ()))


def _adjust_http_request_members(ctx: ClassDefContext) -> None:
    if ctx.cls.name == "HttpRequest":
        if not _has_symbols(ctx.api, _AUTH_TOKEN_TP):
            return ctx.api.defer()

        # added by sentry.api.base and sentry.web.frontend.base
        # TODO: idk why I can't use the real type here :/
        add_attribute_to_class(ctx.api, ctx.cls, "access", AnyType(TypeOfAny.explicit))
        # added by sentry.middleware.auth
        add_attribute_to_class(ctx.api, ctx.cls, "auth", _request_auth_tp(ctx.api))
        # added by csp.middleware.CSPMiddleware
        add_attribute_to_class(ctx.api, ctx.cls, "csp_nonce", ctx.api.named_type("builtins.str"))
        # added by sudo.middleware.SudoMiddleware
        # this is slightly better than a method returning bool for overriding
        returns_bool = CallableType(
            arg_types=[],
            arg_kinds=[],
            arg_names=[],
            ret_type=ctx.api.named_type("builtins.bool"),
            fallback=ctx.api.named_type("builtins.function"),
            name="is_sudo",
        )
        add_attribute_to_class(ctx.api, ctx.cls, "is_sudo", returns_bool)
        # added by sentry.middleware.subdomain
        subdomain_tp = UnionType([NoneType(), ctx.api.named_type("builtins.str")])
        add_attribute_to_class(ctx.api, ctx.cls, "subdomain", subdomain_tp)
        # added by sentry.middleware.superuser
        # TODO: figure out how to get the real types here
        add_attribute_to_class(ctx.api, ctx.cls, "superuser", AnyType(TypeOfAny.explicit))
        # added by OrganizationEndpoint.convert_args and similar
        add_attribute_to_class(ctx.api, ctx.cls, "organization", AnyType(TypeOfAny.explicit))
        # added by sentry.api.authentication.RelayAuthentication
        add_attribute_to_class(ctx.api, ctx.cls, "relay", AnyType(TypeOfAny.explicit))
        add_attribute_to_class(ctx.api, ctx.cls, "relay_request_data", AnyType(TypeOfAny.explicit))
        # added by sentry.api.authentication.ClientIdSecretAuthentication
        add_attribute_to_class(
            ctx.api, ctx.cls, "user_from_signed_request", AnyType(TypeOfAny.explicit)
        )


def _adjust_request_members(ctx: ClassDefContext) -> None:
    if ctx.cls.name == "Request":
        if not _has_symbols(ctx.api, _AUTH_TOKEN_TP):
            return ctx.api.defer()

        # sentry.auth.middleware / sentry.api.authentication
        add_attribute_to_class(ctx.api, ctx.cls, "auth", _request_auth_tp(ctx.api))


def _adjust_http_response_members(ctx: ClassDefContext) -> None:
    if ctx.cls.name == "HttpResponseBase":
        dict_str_list_str = ctx.api.named_type(
            "builtins.dict",
            [
                ctx.api.named_type("builtins.str"),
                ctx.api.named_type("builtins.list", [ctx.api.named_type("builtins.str")]),
            ],
        )
        add_attribute_to_class(ctx.api, ctx.cls, "_csp_replace", dict_str_list_str)


def _lazy_service_wrapper_attribute(ctx: AttributeContext, *, attr: str) -> Type:
    # we use `Any` as the `__getattr__` return value
    # allow existing attributes to be returned as normal if they are not `Any`
    if not isinstance(ctx.default_attr_type, AnyType):
        return ctx.default_attr_type

    assert isinstance(ctx.type, Instance), ctx.type
    assert len(ctx.type.args) == 1, ctx.type
    assert isinstance(ctx.type.args[0], Instance), ctx.type
    generic_type = ctx.type.args[0]

    member = find_member(attr, generic_type, generic_type)
    if member is None:
        ctx.api.fail(
            f'{format_type(ctx.type, ctx.api.options)} has no attribute "{attr}"',
            ctx.context,
            code=ATTR_DEFINED,
        )
        return ctx.default_attr_type
    else:
        return member


_SEER_RPC_MARKER_FULLNAME = "sentry.seer.endpoints.registry.seer_rpc"


def _return_type_contains_any(t: Type) -> bool:
    """Walk a function's return type and report whether any node is a real `Any`.

    Skips `TypeOfAny.special_form` (e.g. `Any` from `Optional[Any]` placeholder
    resolution) and `TypeOfAny.from_error` (already-flagged errors) so we don't
    double-report. Recurses through unions and into the type arguments of
    generic Instances so leaks like `BaseModel | Any | None` or
    `list[Any]` / `dict[str, Any]` are caught.
    """
    seen: set[int] = set()

    def _walk(node: Type) -> bool:
        node = get_proper_type(node)
        if id(node) in seen:
            return False
        seen.add(id(node))
        if isinstance(node, AnyType):
            return node.type_of_any not in (TypeOfAny.special_form, TypeOfAny.from_error)
        if isinstance(node, UnionType):
            return any(_walk(item) for item in node.items)
        if isinstance(node, Instance):
            return any(_walk(arg) for arg in node.args)
        return False

    return _walk(t)


def _check_seer_rpc_handler_not_any(ctx: FunctionContext) -> Type:
    """Enforce that the function passed to `seer_rpc(...)` has a return type
    free of `Any`. The wrapped function is what gets registered into one of
    the three seer RPC registries; an `Any` return there silently breaks the
    seer-side codegen that consumes these methods — the JSON-schema manifest
    built from each registered function's return annotation degenerates to
    "unknown" for the entry, so the typed `RpcClient.call` overloads on the
    seer side lose their specific return type for that method.
    """
    if not ctx.arg_types or not ctx.arg_types[0]:
        return ctx.default_return_type
    fn_type = get_proper_type(ctx.arg_types[0][0])
    if not isinstance(fn_type, CallableType):
        return ctx.default_return_type
    if _return_type_contains_any(fn_type.ret_type):
        ctx.api.fail(
            "Seer RPC handler return type must not contain `Any`: the seer-side "
            "codegen derives its typed `RpcClient.call` overloads from this "
            "annotation, and `Any` collapses the consumer's typed contract for "
            "this method. Define a Pydantic response model in "
            "`sentry.seer.sentry_data_models` and annotate the handler's "
            "return type with it.",
            ctx.context,
        )
    return ctx.default_return_type


_RESPONSE_FULLNAME = "rest_framework.response.Response"
_ASYNC_WRAPPERS = frozenset(
    {
        "typing.Coroutine",
        "typing.Awaitable",
        "typing.AsyncGenerator",
        "typing.AsyncIterator",
        "typing.AsyncIterable",
    }
)


def _unwrap_response_instances_from_return(expected: Type) -> list[Instance]:
    """From a (possibly async-wrapped, possibly union) return type, collect every
    `Response[...]` Instance for inspection. Shared by the body-Any check and
    the dict/list-literal narrowing hook so both see the enclosing return type
    the same way.
    """
    out: list[Instance] = []
    pending: list[Type] = [expected]
    while pending:
        t = get_proper_type(pending.pop())
        if isinstance(t, UnionType):
            pending.extend(t.items)
        elif isinstance(t, Instance):
            if t.type.fullname in _ASYNC_WRAPPERS and t.args:
                pending.extend(t.args)
            else:
                out.append(t)
    return out


def _dict_literal_matches_typeddict(
    body: DictExpr,
    td: TypedDictType,
    expr_checker: Any,
) -> bool:
    """True if `body` (a non-empty dict literal) structurally satisfies `td`.

    Required keys all present, no unknown extras, value types are mypy-subtypes
    of declared field types. We re-check shape here rather than routing through
    mypy's `check_typeddict_call_with_dict` because that method emits errors
    directly on the call site — the plugin needs to probe silently across
    union arms.
    """
    literal_keys: set[str] = set()
    literal_items: dict[str, Type] = {}
    for k_expr, v_expr in body.items:
        if not isinstance(k_expr, StrExpr):
            return False
        literal_keys.add(k_expr.value)
        try:
            literal_items[k_expr.value] = expr_checker.accept(v_expr)
        except Exception:
            return False
    if not td.required_keys.issubset(literal_keys):
        return False
    if literal_keys - set(td.items.keys()):
        return False
    for key, value_type in literal_items.items():
        declared = td.items.get(key)
        if declared is None:
            return False
        if not _is_subtype(value_type, declared):
            return False
    return True


def _empty_dict_matches_arm(arm_T: Type) -> bool:
    """True if `Response({})` satisfies `Response[arm_T]`.

    Matches `dict[K, V]` for any K, V (empty dict inhabits any dict), and
    TypedDicts with no required keys (e.g. `total=False` shapes).
    """
    arm_T = get_proper_type(arm_T)
    if isinstance(arm_T, TypedDictType):
        return not arm_T.required_keys
    if isinstance(arm_T, Instance) and arm_T.type.fullname == "builtins.dict":
        return True
    return False


def _empty_list_matches_arm(arm_T: Type) -> bool:
    """True if `Response([])` satisfies `Response[arm_T]` — any `list[X]` arm.

    Empty list inhabits any `list[X]` because there are no elements that
    could violate `X`.
    """
    arm_T = get_proper_type(arm_T)
    if isinstance(arm_T, Instance) and arm_T.type.fullname == "builtins.list":
        return True
    return False


def _narrow_response_literal_in_union(ctx: FunctionContext) -> Type:
    """Narrow `Response(<literal>, ...)` to a matching arm of the enclosing
    function's union return type.

    Mypy already narrows when the return type is a single `Response[X]`. When
    the return is a union of `Response[...]` arms, mypy gives up bidirectional
    inference and infers the body as the broad type of the literal — which
    doesn't match any specific arm because `Response[T]` is invariant. This
    hook restores the expected narrowing by inspecting each arm.

    Handles three literal shapes:
      - non-empty `DictExpr` → TypedDict-coercion check against TypedDict arms
      - empty `DictExpr` `{}` → matches `dict[K, V]` arms or no-required-keys
        TypedDict arms
      - empty `ListExpr` `[]` → matches `list[T]` arms

    Returns `Response[that_T]` when exactly one arm accepts the literal. Zero
    or multiple matches → returns default (mypy errors). Non-literal bodies
    are untouched. Name-agnostic: no hardcoded TypedDict names.
    """
    if not ctx.args or not ctx.args[0]:
        return ctx.default_return_type
    body_expr = ctx.args[0][0]
    # Identify which literal we're dealing with.
    is_empty_dict = isinstance(body_expr, DictExpr) and not body_expr.items
    is_nonempty_dict = isinstance(body_expr, DictExpr) and bool(body_expr.items)
    is_empty_list = isinstance(body_expr, ListExpr) and not body_expr.items
    if not (is_empty_dict or is_nonempty_dict or is_empty_list):
        return ctx.default_return_type

    arg_name = ctx.arg_names[0][0] if ctx.arg_names and ctx.arg_names[0] else None
    if arg_name not in (None, "data"):
        return ctx.default_return_type

    chk = ctx.api.expr_checker.chk  # type: ignore[attr-defined]
    if not getattr(chk, "return_types", None):
        return ctx.default_return_type

    response_arms: list[Instance] = [
        inst
        for inst in _unwrap_response_instances_from_return(chk.return_types[-1])
        if inst.type.fullname == _RESPONSE_FULLNAME and inst.args
    ]
    if not response_arms:
        return ctx.default_return_type

    expr_checker = ctx.api.expr_checker  # type: ignore[attr-defined]
    matching: list[Instance] = []
    for inst in response_arms:
        T_arg = get_proper_type(inst.args[0])
        if is_nonempty_dict and isinstance(T_arg, TypedDictType):
            assert isinstance(body_expr, DictExpr)
            if _dict_literal_matches_typeddict(body_expr, T_arg, expr_checker):
                matching.append(inst)
        elif is_empty_dict and _empty_dict_matches_arm(T_arg):
            matching.append(inst)
        elif is_empty_list and _empty_list_matches_arm(T_arg):
            matching.append(inst)

    if len(matching) != 1:
        # Zero matches (real drift) or multiple (ambiguous) — fall back to
        # default and let mypy emit its standard error.
        return ctx.default_return_type
    return matching[0]


def _check_response_body_not_any(ctx: FunctionContext) -> Type:
    """Hard-error when `Response[T](body)` is constructed in a context that
    expects `T = <Specific>` but `body` evaluates to `Any`.

    Strategy: consult the expected return type at the call site. If the
    function's declared return is `Response[X]` where `X` is concrete, and the
    body argument is `Any`, error. Bottom-up `T = Any` inference is then
    visible here because `expected_type` is concrete even though
    `default_return_type` may have absorbed `T = Any` from the body.

    Unparameterized `Response(...)` calls (where T defaults to Any via the
    stub) are unaffected — their enclosing function's expected type is also
    `Response[Any]`.
    """
    if not ctx.arg_types or not ctx.arg_types[0]:
        return ctx.default_return_type
    # Identify whether position 0 is actually the body argument. mypy populates
    # `arg_names[0][0]` with the call-site keyword (or `None` for positional).
    # When the body-less overload is matched (e.g. `Response(status=x)`), the
    # keyword at position 0 is `"status"` — not the body. Treating it as the
    # body would spuriously flag `Response(status=untyped_call())` calls.
    arg_name = ctx.arg_names[0][0] if ctx.arg_names and ctx.arg_names[0] else None
    if arg_name not in (None, "data"):
        return ctx.default_return_type
    body_type = ctx.arg_types[0][0]
    if not isinstance(body_type, AnyType):
        return ctx.default_return_type
    if body_type.type_of_any in (TypeOfAny.special_form, TypeOfAny.from_error):
        return ctx.default_return_type

    # Inspect the surrounding type-checker frame for the expected return type.
    # Async wrappers (Coroutine/Awaitable/etc.) and union arms are unwrapped
    # by `_unwrap_response_instances_from_return`.
    chk = ctx.api.expr_checker.chk  # type: ignore[attr-defined]
    if not getattr(chk, "return_types", None):
        return ctx.default_return_type
    for inst in _unwrap_response_instances_from_return(chk.return_types[-1]):
        if inst.type.fullname != _RESPONSE_FULLNAME:
            continue
        if not inst.args:
            continue
        T_expected = inst.args[0]
        if isinstance(T_expected, AnyType):
            continue
        ctx.api.fail(
            f"`Response[{format_type(T_expected, ctx.api.options)}]` body is `Any` "
            "— give the source a proper return type, or use `cast()` at the call site.",
            ctx.context,
        )
        break
    return ctx.default_return_type


def _dispatch_response_hook(ctx: FunctionContext) -> Type:
    """Single Response() construction hook. Tries literal-narrowing first
    (covers dict literals + empty literals); if that doesn't apply, falls
    through to the body-Any check.
    """
    narrowed = _narrow_response_literal_in_union(ctx)
    if narrowed is not ctx.default_return_type:
        return narrowed
    return _check_response_body_not_any(ctx)


from tools.mypy_helpers.serializer_autoderive import (
    SERIALIZER_FULLNAME as _SERIALIZER_FULLNAME,
)
from tools.mypy_helpers.serializer_autoderive import (
    autoderive_serializer_generic as _autoderive_serializer_generic,
)

# --- Input parameter coverage: the cross-file half of the S025-S027 family ---
# These hooks record; they never raise. Coverage needs names defined in other
# modules (a serializer's fields, a parameter constant, a base class's reads),
# which is what puts this half on the mypy host rather than the flake8 visitor.

_QUERY_DICT = "django.http.request._ImmutableQueryDict"
_QUERY_READ_FULLNAMES = frozenset(
    (f"{_QUERY_DICT}.get", f"{_QUERY_DICT}.getlist", f"{_QUERY_DICT}.__getitem__")
)
_EXTEND_SCHEMA_FULLNAME = "drf_spectacular.utils.extend_schema"
_OPEN_API_PARAMETER = "OpenApiParameter"
_FIELD_FULLNAME = "rest_framework.fields.Field"
_HTTP_METHODS = frozenset(("get", "post", "put", "patch", "delete", "head", "options"))
_PATH_LOCATIONS = frozenset(("path", "PATH"))

# Set to a path to collect the inventory. Unset in a normal run, and then no
# recording hook is installed at all, so an ordinary type check pays nothing.
#
# A collecting run must be single-worker and cold-cached:
#
#     SENTRY_INPUT_PARAM_INVENTORY=/tmp/inv.jsonl mypy -n 1 --no-incremental
#     python -m tools.mypy_helpers.plugin /tmp/inv.jsonl
#
# mypy drops a class body when it serializes a TypeInfo, which it does both to
# the incremental cache and between worker processes. A parameter constant's
# name lives in that body, so more than one worker leaves every declaration
# unresolved and the run reports nothing.
_INVENTORY_ENV = "SENTRY_INPUT_PARAM_INVENTORY"
_COLLECTING = bool(os.environ.get(_INVENTORY_ENV))


class _MethodFacts:
    """What one method has already been seen to declare and read.

    Purely a dedupe ledger: mypy checks an expression more than once, so this
    keeps each fact from being appended twice. The report is assembled from the
    appended records, not from here, because facts are split across workers.
    """

    def __init__(self) -> None:
        self.declared: set[str] = set()
        self.declared_serializers: set[str] = set()
        self.unresolved: list[str] = []
        self.reads: dict[str, int] = {}
        self.dynamic: list[int] = []
        self.has_factory = False
        self.body_reads: dict[str, int] = {}
        # None until an @extend_schema(request=...) resolves; leaves the body unchecked.
        self.body_fields: set[str] | None = None


# (path, class fullname, method) -> facts. Base-class reads key on the base, so a
# parameter read by OrganizationEventsEndpointBase is recorded once, not per inheritor.
_INVENTORY: dict[tuple[str, str, str], _MethodFacts] = {}


def _facts(path: str, cls: str, method: str) -> _MethodFacts:
    return _INVENTORY.setdefault((path, cls, method), _MethodFacts())


_ENDPOINT_BASE = "sentry.api.base.Endpoint"

# Reads in a shared base class are keyed under this instead of an HTTP method, so
# `dataset` is reported once against OrganizationEventsEndpointBase rather than
# against each of the forty endpoints that inherit it.
BASE_CLASS_READS = "<base>"


def _enclosing(api: Any) -> tuple[str, str] | None:
    """`(class fullname, method)` for the endpoint code being checked, if any.

    A read inside an HTTP method belongs to that method. A read inside any other
    method of an endpoint class belongs to the class, under `BASE_CLASS_READS`.
    """
    scope = getattr(api, "scope", None)
    if scope is None:
        return None
    func = scope.current_function()
    if func is None:
        return None
    info = scope.enclosing_class()
    if info is None or not any(base.fullname == _ENDPOINT_BASE for base in info.mro):
        return None
    if func.name in _HTTP_METHODS:
        return info.fullname, func.name
    return info.fullname, BASE_CLASS_READS


def _publish_status_expr(info: TypeInfo) -> DictExpr | None:
    """The class's own `publish_status = {...}` literal, read off mypy's AST node."""
    for stmt in info.defn.defs.body:
        if not isinstance(stmt, AssignmentStmt) or not isinstance(stmt.rvalue, DictExpr):
            continue
        for lvalue in stmt.lvalues:
            if isinstance(lvalue, NameExpr) and lvalue.name == "publish_status":
                return stmt.rvalue
    return None


def _records_reads(api: Any, method: str) -> bool:
    """PUBLIC HTTP methods are analyzed; so is any base class, on its own line."""
    if method == BASE_CLASS_READS:
        return True
    scope = getattr(api, "scope", None)
    enclosing = scope.enclosing_class() if scope is not None else None
    return enclosing is not None and _is_public(enclosing, method)


def _is_public(info: TypeInfo, method: str) -> bool:
    """True when the nearest `publish_status` in the MRO marks `method` PUBLIC."""
    for base in info.mro:
        expr = _publish_status_expr(base)
        if expr is None:
            continue
        for key, value in expr.items:
            if (
                isinstance(key, StrExpr)
                and key.value == method.upper()
                and isinstance(value, MemberExpr)
            ):
                return value.name == "PUBLIC"
    return False


def _str_arg(call: CallExpr, name: str, position: int | None = None) -> str | None:
    """A literal string keyword argument, falling back to a positional slot."""
    for arg_name, arg in zip(call.arg_names, call.args):
        if arg_name == name and isinstance(arg, StrExpr):
            return arg.value
    if position is not None:
        positional = [a for n, a in zip(call.arg_names, call.args) if n is None]
        if len(positional) > position and isinstance(positional[position], StrExpr):
            arg = positional[position]
            assert isinstance(arg, StrExpr)
            return arg.value
    return None


def _has_arg(call: CallExpr, name: str) -> bool:
    return any(arg_name == name for arg_name in call.arg_names)


def _is_open_api_parameter_call(expr: Expression) -> bool:
    if not isinstance(expr, CallExpr):
        return False
    callee = expr.callee
    return (isinstance(callee, NameExpr) and callee.name == _OPEN_API_PARAMETER) or (
        isinstance(callee, MemberExpr) and callee.name == _OPEN_API_PARAMETER
    )


def _parameter_from_call(call: CallExpr) -> tuple[str, bool] | None:
    """`(name, is_path)` for an inline `OpenApiParameter(...)`, or None when not literal."""
    name = _str_arg(call, "name", position=0)
    if name is None:
        return None
    is_path = False
    for arg_name, arg in zip(call.arg_names, call.args):
        if arg_name != "location":
            continue
        if isinstance(arg, StrExpr) and arg.value in _PATH_LOCATIONS:
            is_path = True
        elif isinstance(arg, MemberExpr) and arg.name in _PATH_LOCATIONS:
            is_path = True
    return name, is_path


def _var_initializer(info: TypeInfo | MypyFile, attr: str) -> CallExpr | None:
    """The `OpenApiParameter(...)` a class attribute or module constant is bound to.

    mypy's `Var` drops the initializer, so this reads it off the definition site's
    own AST node, which mypy already holds -- no file is opened here.
    """
    body = info.defn.defs.body if isinstance(info, TypeInfo) else info.defs
    for stmt in body:
        if not isinstance(stmt, AssignmentStmt) or not isinstance(stmt.rvalue, CallExpr):
            continue
        for lvalue in stmt.lvalues:
            if isinstance(lvalue, NameExpr) and lvalue.name == attr:
                return stmt.rvalue
    return None


def _serializer_field_names(info: TypeInfo) -> set[str] | None:
    """Field names across a serializer's MRO, or None when it is not a serializer."""
    if not any(base.fullname == _FIELD_FULLNAME for base in info.mro):
        return None
    names: set[str] = set()
    for base in info.mro:
        if base.fullname.startswith("rest_framework."):
            continue
        for name, sym in base.names.items():
            node = sym.node
            typ = get_proper_type(getattr(node, "type", None))
            if isinstance(typ, Instance) and any(
                b.fullname == _FIELD_FULLNAME for b in typ.type.mro
            ):
                names.add(name)
    return names


# Populated from the plugin's `set_modules`, so a module-level constant can be
# resolved back to the module that defines it.
_MODULES: dict[str, MypyFile] = {}

_T = TypeVar("_T")


def _never_fails(fn: Callable[..., _T]) -> Callable[..., _T]:
    """Recording is best-effort; a bug here must not fail anyone's type check."""

    @functools.wraps(fn)
    def wrapper(ctx: Any, *args: Any, **kwargs: Any) -> Any:
        try:
            return fn(ctx, *args, **kwargs)
        except Exception as exc:
            _emit("recording_error", "?", "?", "?", hook=fn.__name__, error=repr(exc))
            return getattr(ctx, "default_signature", None) or ctx.default_return_type

    return wrapper


def _render(expr: Expression) -> str:
    """Short, stable rendering of a declaration we could not resolve."""
    if isinstance(expr, NameExpr):
        return expr.name
    if isinstance(expr, MemberExpr):
        return f"{_render(expr.expr)}.{expr.name}"
    if isinstance(expr, CallExpr):
        return f"{_render(expr.callee)}(...)"
    return type(expr).__name__


def _constant_parameter(expr: Expression) -> tuple[str, bool] | None:
    """Resolve an `OpenApiParameter` constant reference to `(name, is_path)`."""
    if isinstance(expr, MemberExpr):
        owner = expr.expr
        info = owner.node if isinstance(owner, NameExpr) else None
        if isinstance(info, TypeInfo):
            call = _var_initializer(info, expr.name)
            return _parameter_from_call(call) if call is not None else None
        return None
    if isinstance(expr, NameExpr):
        node = expr.node
        fullname = getattr(node, "fullname", None)
        if not fullname or "." not in fullname:
            return None
        module = _MODULES.get(fullname.rsplit(".", 1)[0])
        if module is None:
            return None
        call = _var_initializer(module, expr.name)
        return _parameter_from_call(call) if call is not None else None
    return None


def _factory_parameter(call: CallExpr) -> tuple[str, bool] | None:
    """Resolve `GlobalParams.member_id(...)` to the OpenApiParameter it returns."""
    callee = call.callee
    if not isinstance(callee, MemberExpr):
        return None
    owner = callee.expr
    info = owner.node if isinstance(owner, NameExpr) else None
    if not isinstance(info, TypeInfo):
        return None
    for stmt in info.defn.defs.body:
        func = stmt.func if isinstance(stmt, Decorator) else stmt
        if not isinstance(func, FuncDef) or func.name != callee.name:
            continue
        for inner in func.body.body:
            if isinstance(inner, ReturnStmt) and _is_open_api_parameter_call(inner.expr):
                assert isinstance(inner.expr, CallExpr)
                return _parameter_from_call(inner.expr)
    return None


def _resolve_declaration(expr: Expression, facts: _MethodFacts) -> None:
    """Fold one element of `parameters=[...]` into the method's declared set.

    Anything that does not resolve to a name is recorded as unresolved, which
    suppresses this method's coverage violations rather than guessing at them.
    """
    if isinstance(expr, CallExpr) and _is_open_api_parameter_call(expr):
        parsed = _parameter_from_call(expr)
    elif isinstance(expr, CallExpr):
        facts.has_factory = True
        parsed = _factory_parameter(expr)
    elif isinstance(expr, NameExpr) and isinstance(expr.node, TypeInfo):
        fields = _serializer_field_names(expr.node)
        if fields is None:
            facts.unresolved.append(_render(expr))
        else:
            facts.declared_serializers.add(expr.node.fullname)
            facts.declared.update(fields)
        return
    else:
        parsed = _constant_parameter(expr)
    if parsed is None:
        facts.unresolved.append(_render(expr))
    elif not parsed[1]:
        facts.declared.add(parsed[0])


def _decorator_targets(info: TypeInfo, line: int) -> list[str]:
    """Methods a decorator on `line` applies to; every PUBLIC method when class-level."""
    for dec in info.defn.decorators:
        if dec.line == line:
            return [m for m in _HTTP_METHODS if _is_public(info, m)]
    for stmt in info.defn.defs.body:
        if not isinstance(stmt, Decorator):
            continue
        for dec in stmt.decorators:
            if dec.line == line:
                return [stmt.func.name]
    return []


@_never_fails
def _record_extend_schema(ctx: FunctionContext) -> Type:
    """Fold an `@extend_schema(parameters=...)` into the methods it decorates."""
    scope = getattr(ctx.api, "scope", None)
    info = scope.active_class() if scope is not None else None
    if info is None:
        return ctx.default_return_type
    elements: list[Expression] = []
    bodies: list[Expression] = []
    for name, args in zip(ctx.callee_arg_names, ctx.args):
        if name == "parameters":
            for arg in args:
                if isinstance(arg, (ListExpr, TupleExpr)):
                    elements.extend(arg.items)
                else:
                    elements.append(arg)
        elif name == "request":
            bodies.extend(args)
    if not elements and not bodies:
        return ctx.default_return_type
    path = getattr(ctx.api, "path", "?")
    for method in _decorator_targets(info, ctx.context.line):
        if method not in _HTTP_METHODS or not _is_public(info, method):
            continue
        facts = _facts(path, info.fullname, method)
        for element in elements:
            _resolve_declaration(element, facts)
        for body in bodies:
            _resolve_request_body(body, facts)
        _emit(
            "declared",
            path,
            info.fullname,
            method,
            declared=sorted(facts.declared),
            unresolved=sorted(set(facts.unresolved)),
            serializers=sorted(facts.declared_serializers),
            factory=facts.has_factory,
            body_fields=(sorted(facts.body_fields) if facts.body_fields is not None else None),
        )
    return ctx.default_return_type


@_never_fails
def _record_query_read(ctx: MethodSigContext) -> FunctionLike:
    """Record one query-parameter read against the method being checked."""
    where = _enclosing(ctx.api)
    if where is None:
        return ctx.default_signature
    cls, method = where
    if not _records_reads(ctx.api, method):
        return ctx.default_signature
    path = getattr(ctx.api, "path", "?")
    facts = _facts(path, cls, method)
    args = [arg for arglist in ctx.args for arg in arglist]
    if not args:
        return ctx.default_signature
    key = args[0]
    if isinstance(key, StrExpr):
        if key.value not in facts.reads:
            facts.reads[key.value] = ctx.context.line
            _emit("read", path, cls, method, name=key.value, line=ctx.context.line)
    elif ctx.context.line not in facts.dynamic:
        facts.dynamic.append(ctx.context.line)
        _emit("dynamic", path, cls, method, line=ctx.context.line)
    return ctx.default_signature


# The two helpers that consume a whole QueryDict. Names and parameter sets come
# from the flake8 host so both mechanisms agree on one table.
_KNOWN_HELPER_FULLNAMES = {
    f"sentry.api.utils.{name}": params for name, params in KNOWN_QUERY_HELPERS.items()
}


@_never_fails
def _record_known_helper(ctx: FunctionContext, params: frozenset[str]) -> Type:
    """A known helper reads on the handler's behalf, so its parameters are reads."""
    where = _enclosing(ctx.api)
    if where is None:
        return ctx.default_return_type
    cls, method = where
    if not _records_reads(ctx.api, method):
        return ctx.default_return_type
    path = getattr(ctx.api, "path", "?")
    facts = _facts(path, cls, method)
    for name in params:
        if name not in facts.reads:
            facts.reads[name] = ctx.context.line
            _emit("read", path, cls, method, name=name, line=ctx.context.line, helper=True)
    return ctx.default_return_type


def _is_request_data(expr: Expression) -> bool:
    """True for the `request.data` half of `request.data[...]` / `request.data.get(...)`."""
    return isinstance(expr, MemberExpr) and expr.name == "data"


def _record_body_read(key: Expression, line: int, api: Any) -> None:
    where = _enclosing(api)
    if where is None:
        return
    cls, method = where
    if not _records_reads(api, method):
        return
    if not isinstance(key, StrExpr):
        return
    path = getattr(api, "path", "?")
    facts = _facts(path, cls, method)
    if key.value not in facts.body_reads:
        facts.body_reads[key.value] = line
        _emit("body_read", path, cls, method, name=key.value, line=line)


@_never_fails
def _record_body_get(ctx: MethodSigContext) -> FunctionLike:
    """`request.data.get("k")` -- guarded so ordinary dict reads cost two checks."""
    callee = ctx.context.callee if isinstance(ctx.context, CallExpr) else None
    if isinstance(callee, MemberExpr) and _is_request_data(callee.expr):
        args = [arg for arglist in ctx.args for arg in arglist]
        if args:
            _record_body_read(args[0], ctx.context.line, ctx.api)
    return ctx.default_signature


@_never_fails
def _record_body_index(ctx: MethodContext) -> Type:
    """`request.data["k"]` -- same guard as the `.get` form."""
    context = ctx.context
    if isinstance(context, IndexExpr) and _is_request_data(context.base):
        _record_body_read(context.index, context.line, ctx.api)
    return ctx.default_return_type


def _inline_serializer_fields(call: CallExpr) -> set[str] | None:
    """Field names from `inline_serializer(name=..., fields={...})`."""
    for arg_name, arg in zip(call.arg_names, call.args):
        if arg_name != "fields" or not isinstance(arg, DictExpr):
            continue
        names = set()
        for key, _ in arg.items:
            if not isinstance(key, StrExpr):
                return None
            names.add(key.value)
        return names
    return None


def _resolve_request_body(expr: Expression, facts: _MethodFacts) -> None:
    """Record the declared request serializer's field names, or leave the body unchecked."""
    if isinstance(expr, NameExpr) and isinstance(expr.node, TypeInfo):
        fields = _serializer_field_names(expr.node)
        if fields is not None:
            facts.body_fields = fields
        return
    if isinstance(expr, CallExpr):
        callee = expr.callee
        is_inline = (isinstance(callee, NameExpr) and callee.name == "inline_serializer") or (
            isinstance(callee, MemberExpr) and callee.name == "inline_serializer"
        )
        if is_inline:
            fields = _inline_serializer_fields(expr)
            if fields is not None:
                facts.body_fields = fields


def _emit(kind: str, path: str, cls: str, method: str, **payload: Any) -> None:
    """Append one newly-discovered fact.

    mypy checks in worker subprocesses and exits through `os._exit`, so nothing
    survives in memory and `atexit` never runs; each new fact is appended as it
    is found and the records are joined when the report is rendered.
    """
    destination = os.environ.get(_INVENTORY_ENV)
    if not destination:
        return
    record = {"kind": kind, "path": path, "cls": cls, "method": method, **payload}
    with open(destination, "a") as fh:
        fh.write(json.dumps(record) + "\n")


class SentryMypyPlugin(Plugin):
    def __init__(self, options: Options) -> None:
        super().__init__(options)
        # Resolving a parameter constant means reading the initializer off the
        # defining module's AST, which mypy frees once an SCC is done. Keep them
        # only while an inventory is being collected, so ordinary runs pay nothing.
        if _COLLECTING:
            options.preserve_asts = True

    def get_function_hook(self, fullname: str) -> Callable[[FunctionContext], Type] | None:
        if fullname == _RESPONSE_FULLNAME:
            return _dispatch_response_hook
        if fullname == _SEER_RPC_MARKER_FULLNAME:
            return _check_seer_rpc_handler_not_any
        if _COLLECTING:
            if fullname == _EXTEND_SCHEMA_FULLNAME:
                return _record_extend_schema
            params = _KNOWN_HELPER_FULLNAMES.get(fullname)
            if params is not None:
                return functools.partial(_record_known_helper, params=params)
        return None

    def get_function_signature_hook(
        self, fullname: str
    ) -> Callable[[FunctionSigContext], FunctionLike] | None:
        return _FUNCTION_SIGNATURE_HOOKS.get(fullname)

    def get_method_signature_hook(
        self, fullname: str
    ) -> Callable[[MethodSigContext], FunctionLike] | None:
        if fullname.startswith("django.core.cache.backends.base.BaseCache."):
            return _modify_base_cache_version_type
        elif _COLLECTING and fullname in _QUERY_READ_FULLNAMES:
            return _record_query_read
        elif _COLLECTING and fullname == "builtins.dict.get":
            return _record_body_get
        else:
            return None

    def get_method_hook(self, fullname: str) -> Callable[[MethodContext], Type] | None:
        if _COLLECTING and fullname == "builtins.dict.__getitem__":
            return _record_body_index
        if fullname in (
            "django.core.cache.backends.base.BaseCache.adecr_version",
            "django.core.cache.backends.base.BaseCache.aincr_version",
            "django.core.cache.backends.base.BaseCache.decr_version",
            "django.core.cache.backends.base.BaseCache.incr_version",
        ):
            return _remove_base_cache_decr_incr
        else:
            return None

    def get_customize_class_mro_hook(
        self, fullname: str
    ) -> Callable[[ClassDefContext], None] | None:
        if fullname == "django.http.request.HttpRequest":
            return _adjust_http_request_members
        elif fullname == "rest_framework.request.Request":
            return _adjust_request_members
        elif fullname == "django.http.response.HttpResponseBase":
            return _adjust_http_response_members
        else:
            return None

    def get_base_class_hook(self, fullname: str) -> Callable[[ClassDefContext], None] | None:
        if fullname == _SERIALIZER_FULLNAME:
            return _autoderive_serializer_generic
        return None

    def get_attribute_hook(self, fullname: str) -> Callable[[AttributeContext], Type] | None:
        if fullname.startswith("sentry.utils.lazy_service_wrapper.LazyServiceWrapper."):
            _, attr = fullname.rsplit(".", 1)
            return functools.partial(_lazy_service_wrapper_attribute, attr=attr)
        else:
            return None

    def set_modules(self, modules: dict[str, MypyFile]) -> None:
        super().set_modules(modules)
        global _MODULES
        _MODULES = modules

    def get_additional_deps(self, file: MypyFile) -> list[tuple[int, str, int]]:
        if file.fullname in {"django.http", "django.http.request", "rest_framework.request"}:
            return [(PRI_MYPY, "sentry.auth.services.auth.model", -1)]
        else:
            return []


def plugin(version: str) -> type[SentryMypyPlugin]:
    return SentryMypyPlugin


def _render_inventory(path: str, only: str | None = None) -> str:
    """Join the appended records into the per-pattern inventory and summary."""
    methods: dict[tuple[str, str, str], dict[str, Any]] = {}
    single_file: dict[str, list[str]] = {}
    errors: set[str] = set()
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            if record["kind"] == "recording_error":
                errors.add(f"{record['hook']}: {record['error']}")
                continue
            if record["kind"] == "single_file":
                single_file.setdefault(record["pattern"], []).append(
                    f"  {record['path']}:{record['line']}: {record['message']}"
                )
                continue
            key = (record["path"], record["cls"], record["method"])
            entry = methods.setdefault(
                key,
                {
                    "declared": set(),
                    "unresolved": set(),
                    "serializers": set(),
                    "factory": False,
                    "reads": {},
                    "body_reads": {},
                    "dynamic": [],
                    "body_fields": None,
                },
            )
            kind = record["kind"]
            if kind == "declared":
                entry["declared"].update(record["declared"])
                entry["unresolved"].update(record["unresolved"])
                entry["serializers"].update(record["serializers"])
                entry["factory"] = entry["factory"] or record["factory"]
                if record["body_fields"] is not None:
                    entry["body_fields"] = set(record["body_fields"]) | (
                        entry["body_fields"] or set()
                    )
            elif kind == "read":
                entry["reads"].setdefault(record["name"], record["line"])
            elif kind == "body_read":
                entry["body_reads"].setdefault(record["name"], record["line"])
            elif kind == "dynamic":
                entry["dynamic"].append(record["line"])

    grouped: dict[str, list[str]] = {p: [] for p in INPUT_PATTERNS}
    counts = {p: [0, 0, 0, 0] for p in INPUT_PATTERNS}
    for (file, cls, method), entry in sorted(methods.items()):
        if entry["serializers"]:
            pattern = "F"
        elif entry["dynamic"]:
            pattern = "E"
        elif entry["factory"]:
            pattern = "B"
        else:
            pattern = "A"
        stats = counts[pattern]
        stats[0] += 1
        if entry["reads"] or entry["body_reads"]:
            stats[1] += 1
        where = f"{cls.rsplit('.', 1)[-1]}.{method}"
        if method == BASE_CLASS_READS:
            # A base class declares no parameters of its own, so its reads are an
            # attribution: they count against whichever inheritor fails to declare them.
            base = cls.rsplit(".", 1)[-1]
            names = ", ".join(sorted(entry["reads"]))
            if names:
                grouped[pattern].append(f"  {file}: {base} reads {names} for its inheritors")
            continue
        if entry["unresolved"]:
            stats[3] += 1
            for rendered in sorted(entry["unresolved"]):
                grouped[pattern].append(
                    f"  {file}: {where}: unresolved declaration {rendered}; coverage suppressed"
                )
            continue
        findings = [
            (line, f"query parameter {name!r} is read but not declared in parameters=")
            for name, line in entry["reads"].items()
            if name not in entry["declared"]
        ]
        if entry["body_fields"] is not None:
            findings += [
                (line, f"body key {name!r} is absent from the serializer declared in request=")
                for name, line in entry["body_reads"].items()
                if name not in entry["body_fields"]
            ]
        if findings:
            stats[2] += 1
        for line, text in sorted(findings):
            grouped[pattern].append(f"  {file}:{line}: [{pattern}] {where}: {text}")

    for pattern, rows in single_file.items():
        grouped.setdefault(pattern, []).extend(sorted(set(rows)))

    shown = [p for p in INPUT_PATTERNS if only is None or p == only]
    out = ["Input parameter inventory", "=" * 78, ""]
    for pattern in shown:
        out.append(f"Pattern {pattern}: {len(grouped[pattern])} finding(s)")
        out.extend(grouped[pattern])
        out.append("")
    out.append(f"{'pattern':<10}{'PUBLIC':>8}{'reading':>9}{'violating':>11}{'unresolved':>12}")
    for pattern in shown:
        public, reading, violating, unresolved = counts[pattern]
        out.append(f"{pattern:<10}{public:>8}{reading:>9}{violating:>11}{unresolved:>12}")
    out.append("")
    out.append(f"ENFORCED = {sorted(ENFORCED) or 'none, so nothing gates'}")
    if errors:
        out.append("")
        out.append("Hooks that failed and were suppressed, so this report is incomplete:")
        out.extend(f"  {error}" for error in sorted(errors))
    return "\n".join(out)


if __name__ == "__main__":
    import sys

    # `python -m tools.mypy_helpers.plugin <inventory> [pattern]` renders what the
    # hooks recorded. Reading one pattern at a time keeps the first report legible.
    print(_render_inventory(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None))
