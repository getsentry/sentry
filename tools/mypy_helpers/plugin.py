from __future__ import annotations

from typing import Callable

from mypy.nodes import ARG_POS, TypeInfo
from mypy.plugin import FunctionSigContext, MethodSigContext, Plugin
from mypy.types import CallableType, FunctionLike, Instance


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


def field_descriptor_no_overloads(ctx: MethodSigContext) -> FunctionLike:
    # ignore the class / non-model instance descriptor overloads
    signature = ctx.default_signature
    # replace `def __get__(self, inst: Model, owner: Any) -> _GT:`
    # with `def __get__(self, inst: Any, owner: Any) -> _GT:`
    if str(signature.arg_types[0]) == "django.db.models.base.Model":
        return signature.copy_modified(arg_types=[signature.arg_types[1]] * 2)
    else:
        return signature


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


def plugin(version: str) -> type[SentryMypyPlugin]:
    return SentryMypyPlugin
