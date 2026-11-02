from __future__ import annotations

from collections.abc import Callable
from typing import Any, cast

from drf_spectacular.drainage import get_override
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.plumbing import force_instance, safe_ref
from rest_framework.generics import GenericAPIView

from sentry.apidocs.internal.response_annotations import (
    UNDOCUMENTED_EXTENSION,
    annotated_response,
    inferred_response_serializer,
    response_type,
)
from sentry.apidocs.omissions import DEPRECATION_REASONS_OVERRIDE
from sentry.apidocs.schema import SentrySchema


class InternalSchema(SentrySchema):
    """`SentrySchema`, describing the responses no `@extend_schema` declares as well.

    An undeclared response is read from the handler's `Response[T]` annotation. Without
    one, drf-spectacular guesses it from the view's serializer if the view has one, and
    otherwise it is marked `x-sentry-undocumented`.
    """

    def _map_serializer(
        self, serializer: Any, direction: Any, bypass_extensions: bool = False
    ) -> Any:
        """Mark the fields `@sentry_schema_serializer(deprecate=...)` declares deprecated.

        This build runs with omissions off, and `SentrySchema` then maps a serializer as
        if its decorator declared nothing, deprecations included: that is the baseline the
        published build compares against. This build omits nothing, but keeps them."""
        schema = super()._map_serializer(serializer, direction, bypass_extensions)
        properties = schema.get("properties", {})
        instance = cast("Callable[[object], object]", force_instance)(serializer)
        deprecated = get_override(instance, DEPRECATION_REASONS_OVERRIDE, {})
        for name in deprecated or {}:
            if name in properties:
                # As drf-spectacular marks one, keeping a `$ref` in its own context.
                properties[name] = safe_ref({**properties[name], "deprecated": True})
        return schema

    def get_response_serializers(self) -> Any:
        annotated = annotated_response(self.view_func, f"{self.method} {self.path}")
        if annotated is not None:
            if not annotated.types:
                return {"204": None}
            return inferred_response_serializer(response_type(annotated.types))
        if _guesses_serializer(self.view):
            return super().get_response_serializers()
        if self.method == "DELETE":
            return {"204": None}
        return {"200": {UNDOCUMENTED_EXTENSION: True}}

    def _get_serializer(self) -> Any:
        """Skip drf-spectacular's serializer guess for views that give it nothing to go on.

        It reports an error for each, which a build describing every undocumented
        endpoint would otherwise report hundreds of times over."""
        if not _guesses_serializer(self.view):
            return None
        return cast("Callable[..., Any]", super()._get_serializer)()


def _guesses_serializer(view: Any) -> bool:
    """Whether drf-spectacular can derive a serializer from the view itself."""
    return (
        isinstance(view, GenericAPIView)
        or callable(getattr(view, "get_serializer", None))
        or callable(getattr(view, "get_serializer_class", None))
        or hasattr(view, "serializer_class")
    )


# The internal variant of each schema class seen, so each is made once per process.
_internal_schema_classes: dict[type[AutoSchema], type[AutoSchema]] = {}


def internal_schema_class(schema_class: type[AutoSchema]) -> type[AutoSchema]:
    """`schema_class`, with `InternalSchema` inserted directly above `SentrySchema`.

    `@extend_schema` subclasses the schema class when it decorates, and its overrides
    fall back to `super()` only for what it does not declare. Below them, a declared
    response keeps taking precedence over an inferred one. Schema classes that do not
    build on `SentrySchema` are left alone.
    """
    if schema_class not in _internal_schema_classes:
        _internal_schema_classes[schema_class] = _with_internal_schema(schema_class)
    return _internal_schema_classes[schema_class]


def _with_internal_schema(schema_class: type[AutoSchema]) -> type[AutoSchema]:
    if schema_class is SentrySchema:
        return InternalSchema
    if not issubclass(schema_class, SentrySchema) or issubclass(schema_class, InternalSchema):
        return schema_class
    # C3 linearization puts InternalSchema after every class of `schema_class` that
    # subclasses SentrySchema, and before SentrySchema itself.
    return type(f"Internal{schema_class.__name__}", (schema_class, InternalSchema), {})
