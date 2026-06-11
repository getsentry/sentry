from __future__ import annotations

import functools
from collections.abc import Callable
from typing import Any

from mypy.build import PRI_MYPY
from mypy.errorcodes import ATTR_DEFINED
from mypy.messages import format_type
from mypy.nodes import ARG_POS, DictExpr, ListExpr, MypyFile, StrExpr, TypeInfo
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


class SentryMypyPlugin(Plugin):
    def get_function_hook(self, fullname: str) -> Callable[[FunctionContext], Type] | None:
        if fullname == _RESPONSE_FULLNAME:
            return _dispatch_response_hook
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
        else:
            return None

    def get_method_hook(self, fullname: str) -> Callable[[MethodContext], Type] | None:
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

    def get_additional_deps(self, file: MypyFile) -> list[tuple[int, str, int]]:
        if file.fullname in {"django.http", "django.http.request", "rest_framework.request"}:
            return [(PRI_MYPY, "sentry.auth.services.auth.model", -1)]
        else:
            return []


def plugin(version: str) -> type[SentryMypyPlugin]:
    return SentryMypyPlugin
