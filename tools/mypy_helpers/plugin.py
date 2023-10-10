from __future__ import annotations

from typing import Callable

from mypy.nodes import ARG_POS, TypeInfo
from mypy.plugin import ClassDefContext, FunctionSigContext, MethodSigContext, Plugin
from mypy.plugins.common import add_attribute_to_class
from mypy.types import AnyType, CallableType, FunctionLike, Instance, NoneType, TypeOfAny, UnionType


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


def _choice_field_choices_sequence(ctx: FunctionSigContext) -> CallableType:
    sig = ctx.default_signature
    assert sig.arg_names[0] == "choices", sig
    any_type = AnyType(TypeOfAny.explicit)
    sequence_any = ctx.api.named_generic_type("typing.Sequence", [any_type])
    return sig.copy_modified(arg_types=[sequence_any, *sig.arg_types[1:]])


_FUNCTION_SIGNATURE_HOOKS = {
    "django.db.transaction.atomic": replace_transaction_atomic_sig_callback,
    "django.db.transaction.get_connection": _make_using_required_str,
    "django.db.transaction.on_commit": _make_using_required_str,
    "django.db.transaction.set_rollback": _make_using_required_str,
    "rest_framework.fields.ChoiceField": _choice_field_choices_sequence,
    "rest_framework.fields.MultipleChoiceField": _choice_field_choices_sequence,
}


def field_descriptor_no_overloads(ctx: MethodSigContext) -> FunctionLike:
    # ignore the class / non-model instance descriptor overloads
    signature = ctx.default_signature
    # replace `def __get__(self, inst: Model, owner: Any) -> _GT:`
    # with `def __get__(self, inst: Any, owner: Any) -> _GT:`
    if str(signature.arg_types[0]) == "django.db.models.base.Model":
        return signature.copy_modified(arg_types=[signature.arg_types[1]] * 2)
    else:
        return signature


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


class SentryMypyPlugin(Plugin):
    def get_function_signature_hook(
        self, fullname: str
    ) -> Callable[[FunctionSigContext], FunctionLike] | None:
        return _FUNCTION_SIGNATURE_HOOKS.get(fullname)

    def get_method_signature_hook(
        self, fullname: str
    ) -> Callable[[MethodSigContext], FunctionLike] | None:
        if fullname == "django.db.models.fields.Field":
            return field_descriptor_no_overloads

        clsname, _, methodname = fullname.rpartition(".")
        if methodname != "__get__":
            return None

        clsinfo = self.lookup_fully_qualified(clsname)
        if clsinfo is None or not isinstance(clsinfo.node, TypeInfo):
            return None

        fieldinfo = self.lookup_fully_qualified("django.db.models.fields.Field")
        if fieldinfo is None:
            return None

        if fieldinfo.node in clsinfo.node.mro:
            return field_descriptor_no_overloads
        else:
            return None

    def get_base_class_hook(self, fullname: str) -> Callable[[ClassDefContext], None] | None:
        # XXX: this is a hack -- I don't know if there's a better callback to modify a class
        if fullname == "io.BytesIO":
            return _adjust_http_request_members
        else:
            return None


def plugin(version: str) -> type[SentryMypyPlugin]:
    return SentryMypyPlugin
