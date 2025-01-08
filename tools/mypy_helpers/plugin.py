from __future__ import annotations

import functools
from collections.abc import Callable

from mypy.errorcodes import ATTR_DEFINED
from mypy.messages import format_type
from mypy.nodes import ARG_POS
from mypy.plugin import AttributeContext, ClassDefContext, FunctionSigContext, Plugin
from mypy.plugins.common import add_attribute_to_class
from mypy.subtypes import find_member
from mypy.types import (
    AnyType,
    CallableType,
    FunctionLike,
    Instance,
    NoneType,
    Type,
    TypeOfAny,
    UnionType,
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


def _adjust_http_request_members(ctx: ClassDefContext) -> None:
    if ctx.cls.name == "HttpRequest":
        # added by sentry.api.base and sentry.web.frontend.base
        # TODO: idk why I can't use the real type here :/
        add_attribute_to_class(ctx.api, ctx.cls, "access", AnyType(TypeOfAny.explicit))
        # added by sentry.middleware.auth
        # TODO: figure out how to get the real types here
        add_attribute_to_class(ctx.api, ctx.cls, "auth", AnyType(TypeOfAny.explicit))
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


class SentryMypyPlugin(Plugin):
    def get_function_signature_hook(
        self, fullname: str
    ) -> Callable[[FunctionSigContext], FunctionLike] | None:
        return _FUNCTION_SIGNATURE_HOOKS.get(fullname)

    def get_base_class_hook(self, fullname: str) -> Callable[[ClassDefContext], None] | None:
        # XXX: this is a hack -- I don't know if there's a better callback to modify a class
        if fullname == "_io.BytesIO":
            return _adjust_http_request_members
        else:
            return None

    def get_attribute_hook(self, fullname: str) -> Callable[[AttributeContext], Type] | None:
        if fullname.startswith("sentry.utils.lazy_service_wrapper.LazyServiceWrapper."):
            _, attr = fullname.rsplit(".", 1)
            return functools.partial(_lazy_service_wrapper_attribute, attr=attr)
        else:
            return None


def plugin(version: str) -> type[SentryMypyPlugin]:
    return SentryMypyPlugin
