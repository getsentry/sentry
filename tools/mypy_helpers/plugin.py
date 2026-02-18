from __future__ import annotations

import functools
from collections.abc import Callable

from mypy.build import PRI_MYPY
from mypy.errorcodes import ATTR_DEFINED
from mypy.messages import format_type
from mypy.nodes import ARG_POS, MypyFile, TypeInfo, Var
from mypy.plugin import (
    AttributeContext,
    ClassDefContext,
    FunctionSigContext,
    MethodContext,
    MethodSigContext,
    Plugin,
    SemanticAnalyzerPluginInterface,
)
from mypy.plugins.common import add_attribute_to_class
from mypy.subtypes import find_member
from mypy.typeanal import make_optional_type
from mypy.types import (
    AnyType,
    CallableType,
    FunctionLike,
    Instance,
    NoneType,
    Type,
    TypeOfAny,
    TypeVarType,
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


def _type_contains_self(typ: Type) -> bool:
    """Check if a type tree contains a Self TypeVarType."""
    if isinstance(typ, TypeVarType):
        return typ.id.is_self()
    if isinstance(typ, Instance):
        return any(_type_contains_self(arg) for arg in typ.args)
    if isinstance(typ, UnionType):
        return any(_type_contains_self(item) for item in typ.items)
    return False


def _replace_self_in_type(typ: Type, replacement: Type) -> Type:
    """Replace Self TypeVarType with a concrete type throughout a type tree."""
    if isinstance(typ, TypeVarType) and typ.id.is_self():
        return replacement
    if isinstance(typ, Instance):
        if not typ.args:
            return typ
        new_args = [_replace_self_in_type(arg, replacement) for arg in typ.args]
        return typ.copy_modified(args=new_args)
    if isinstance(typ, UnionType):
        new_items = [_replace_self_in_type(item, replacement) for item in typ.items]
        return UnionType(new_items)
    return typ


def _resolve_model_id_self(ctx: ClassDefContext) -> None:
    """
    Resolve Self in the inherited ``id`` field type for model subclasses.

    The base Model declares ``id: Field[int, Id[Self]]``.  django-stubs reads
    field types from TypeInfo without resolving Self, causing unresolved types
    in ``.values()``, ``.values_list()``, and FK ``.filter()`` contexts.  This
    hook creates a class-local override with Self resolved to the concrete
    model type so that, e.g., ``Organization.id`` is typed
    ``Field[int, Id[Organization]]``.
    """
    info = ctx.cls.info
    if not info.mro:
        return

    # If this class already defines id locally without Self, nothing to do.
    if "id" in info.names:
        node = info.names["id"].node
        if isinstance(node, Var) and isinstance(node.type, Instance):
            if not _type_contains_self(node.type):
                return

    # Walk the MRO (skipping self) to find the original id definition with Self.
    original_type: Instance | None = None
    for base_info in info.mro[1:]:
        if "id" in base_info.names:
            node = base_info.names["id"].node
            if isinstance(node, Var) and isinstance(node.type, Instance):
                if _type_contains_self(node.type):
                    original_type = node.type
                    break

    if original_type is None:
        return

    concrete_type = Instance(info, [])
    resolved_type = _replace_self_in_type(original_type, concrete_type)

    add_attribute_to_class(ctx.api, ctx.cls, "id", resolved_type)


# Cache: model fullname -> {attname: (related_model_fullname, nullable)}
_fk_field_cache: dict[str, dict[str, tuple[str, bool]]] = {}


def _get_fk_fields(model_fullname: str) -> dict[str, tuple[str, bool]]:
    """Look up FK fields for a model class via Django's runtime _meta API.

    Returns a dict mapping attname (e.g. "organization_id") to
    (related_model_fullname, nullable).
    """
    if model_fullname in _fk_field_cache:
        return _fk_field_cache[model_fullname]

    result: dict[str, tuple[str, bool]] = {}
    try:
        from django.apps import apps
        from django.db.models.fields.related import ForeignKey

        module, _, class_name = model_fullname.rpartition(".")
        model_cls = None
        for m in apps.get_models(include_auto_created=True):
            if m.__module__ == module and m.__name__ == class_name:
                model_cls = m
                break

        if model_cls is not None:
            for field in model_cls._meta.get_fields():
                if isinstance(field, ForeignKey):
                    related = field.related_model
                    related_fullname = f"{related.__module__}.{related.__name__}"
                    result[field.attname] = (related_fullname, field.null)
    except Exception:
        pass

    _fk_field_cache[model_fullname] = result
    return result


_id_type_info: TypeInfo | None = None


def _lookup_typeinfo(ctx: AttributeContext, fullname: str) -> TypeInfo | None:
    """Look up a TypeInfo by fully qualified name via the checker's module graph."""
    # Access the TypeChecker's modules dict (not in the official API but stable).
    modules = getattr(ctx.api, "modules", None)
    if modules is None:
        return None
    module_name, _, class_name = fullname.rpartition(".")
    module = modules.get(module_name)
    if module is None:
        return None
    sym = module.names.get(class_name)
    if sym is None or not isinstance(sym.node, TypeInfo):
        return None
    return sym.node


def _resolve_fk_id_attribute(ctx: AttributeContext, *, class_fullname: str, attr_name: str) -> Type:
    """Resolve a FK _id attribute to Id[RelatedModel] at type-checking time."""
    if not isinstance(ctx.default_attr_type, AnyType):
        return ctx.default_attr_type

    fk_fields = _get_fk_fields(class_fullname)
    if attr_name not in fk_fields:
        return ctx.default_attr_type

    related_fullname, nullable = fk_fields[attr_name]

    global _id_type_info
    if _id_type_info is None:
        _id_type_info = _lookup_typeinfo(ctx, "sentry.types.id.Id")
    if _id_type_info is None:
        return ctx.default_attr_type

    related_info = _lookup_typeinfo(ctx, related_fullname)
    if related_info is None:
        return ctx.default_attr_type

    id_type: Type = Instance(_id_type_info, [Instance(related_info, [])])
    if nullable:
        id_type = UnionType([id_type, NoneType()])
    return id_type


def _process_silo_model(ctx: ClassDefContext) -> None:
    """Process a model decorated with @region_silo_model or @control_silo_model."""
    _resolve_model_id_self(ctx)


class SentryMypyPlugin(Plugin):
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

    def get_class_decorator_hook(self, fullname: str) -> Callable[[ClassDefContext], None] | None:
        if fullname in (
            "sentry.db.models.base.region_silo_model",
            "sentry.db.models.base.control_silo_model",
        ):
            return _process_silo_model
        return None

    def get_attribute_hook(self, fullname: str) -> Callable[[AttributeContext], Type] | None:
        if fullname.startswith("sentry.utils.lazy_service_wrapper.LazyServiceWrapper."):
            _, attr = fullname.rsplit(".", 1)
            return functools.partial(_lazy_service_wrapper_attribute, attr=attr)

        # Resolve FK _id attributes to Id[RelatedModel] on Sentry model classes.
        # The _id suffix is a cheap pre-filter; actual FK validation happens in
        # _resolve_fk_id_attribute via Django's _meta API (not all _id attrs are FKs).
        if fullname.startswith("sentry.") and fullname.endswith("_id"):
            class_fullname, _, attr_name = fullname.rpartition(".")
            return functools.partial(
                _resolve_fk_id_attribute,
                class_fullname=class_fullname,
                attr_name=attr_name,
            )

        return None

    def get_additional_deps(self, file: MypyFile) -> list[tuple[int, str, int]]:
        if file.fullname in {"django.http", "django.http.request", "rest_framework.request"}:
            return [(PRI_MYPY, "sentry.auth.services.auth.model", -1)]
        else:
            return []


def plugin(version: str) -> type[SentryMypyPlugin]:
    return SentryMypyPlugin
