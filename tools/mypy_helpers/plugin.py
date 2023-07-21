from __future__ import annotations

from typing import Callable

from mypy.nodes import ARG_POS
from mypy.plugin import FunctionSigContext, Plugin
from mypy.types import CallableType, FunctionLike, Instance


def replace_transaction_atomic_sig_callback(ctx: FunctionSigContext) -> CallableType:
    signature = ctx.default_signature

    using_arg = signature.argument_by_name("using")
    if not using_arg:
        # No using arg in the signature, bail
        return signature

    # We care about context managers.
    ret_type = signature.ret_type
    if not isinstance(ret_type, Instance):
        return signature

    # Replace the type and remove the default value of using.
    str_type = ctx.api.named_generic_type("builtins.str", [])

    arg_types = signature.arg_types[1:]
    arg_kinds = signature.arg_kinds[1:]

    return signature.copy_modified(
        arg_kinds=[ARG_POS, *arg_kinds],
        arg_types=[str_type, *arg_types],
    )


def replace_get_connection_sig_callback(ctx: FunctionSigContext) -> CallableType:
    signature = ctx.default_signature
    using_arg = signature.argument_by_name("using")
    if not using_arg:
        ctx.api.fail("The using parameter is required", ctx.context)

    str_type = ctx.api.named_generic_type("builtins.str", [])

    return signature.copy_modified(arg_kinds=[ARG_POS], arg_types=[str_type])


def replace_trailing_using_sig_callback(ctx: FunctionSigContext) -> CallableType:
    signature = ctx.default_signature
    using_arg = signature.argument_by_name("using")
    if not using_arg:
        ctx.api.fail("The using parameter is required", ctx.context)

    # Update the parameter type to be required and str
    str_type = ctx.api.named_generic_type("builtins.str", [])
    arg_kinds = signature.arg_kinds[0:-1]
    arg_types = signature.arg_types[0:-1]

    return signature.copy_modified(
        arg_kinds=[*arg_kinds, ARG_POS], arg_types=[*arg_types, str_type]
    )


class SentryMypyPlugin(Plugin):
    def get_function_signature_hook(
        self, fullname: str
    ) -> Callable[[FunctionSigContext], FunctionLike] | None:
        if fullname == "django.db.transaction.atomic":
            return replace_transaction_atomic_sig_callback
        if fullname == "django.db.transaction.get_connection":
            return replace_get_connection_sig_callback
        if fullname == "django.db.transaction.on_commit":
            return replace_trailing_using_sig_callback
        if fullname == "django.db.transaction.set_rollback":
            return replace_trailing_using_sig_callback
        return None


def plugin(version: str) -> type[SentryMypyPlugin]:
    return SentryMypyPlugin
