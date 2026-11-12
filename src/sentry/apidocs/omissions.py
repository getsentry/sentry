"""Withholding part of a serializer from the public API schema. Omitted parts
vanish from every generated SDK but are still accepted at runtime.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import TypeVar, get_type_hints

from drf_spectacular.drainage import get_override, set_override
from rest_framework.serializers import BaseSerializer

from sentry.apidocs.omission_paths import _descend, nested_field_message, parse_path

# Override keys holding ``{path: reason}``. Read by SentrySchema and by the
# linter; drf-spectacular itself ignores them.
OMISSION_REASONS_OVERRIDE = "sentry_omission_reasons"
DEPRECATION_REASONS_OVERRIDE = "sentry_deprecation_reasons"

T = TypeVar("T", bound=type)


def _check_reasons(declared: dict[str, str], keyword: str, remedy: str) -> None:
    for path, reason in declared.items():
        parse_path(path)
        if not reason or not reason.strip():
            raise ValueError(
                f"{keyword}['{path}'] needs a reason explaining why the field is not "
                f"part of the public API surface. {remedy}"
            )


def sentry_schema_serializer(
    *,
    omit_from_public_schema: dict[str, str] | None = None,
    deprecate: dict[str, str] | None = None,
    deprecate_fields: Sequence[str] | None = None,
) -> Callable[[T], T]:
    """Withhold or deprecate parts of the generated schema, recording why.

    A key names a field, or ``field.choice`` to withhold one choice value.
    ``deprecate_fields`` is the older list form.
    """
    omit_from_public_schema = omit_from_public_schema or {}
    deprecate = deprecate or {}
    if not omit_from_public_schema and not deprecate and not deprecate_fields:
        raise ValueError(
            "sentry_schema_serializer() requires at least one path in "
            "omit_from_public_schema or deprecate; remove the decorator instead."
        )

    both = sorted(set(omit_from_public_schema) & set(deprecate))
    if both:
        raise ValueError(
            f"{both[0]!r} is both withheld and deprecated; a path that is absent from "
            f"the schema cannot also be marked in it."
        )

    _check_reasons(
        omit_from_public_schema,
        "omit_from_public_schema",
        "If the field is simply undocumented, add a help_text to it instead of omitting it.",
    )
    _check_reasons(deprecate, "deprecate", "Say what replaces it and when it goes away.")

    too_deep = sorted(path for path in omit_from_public_schema if path.count(".") > 1)
    if too_deep:
        raise ValueError(
            f"omit_from_public_schema[{too_deep[0]!r}] is deeper than 'field.choice'. To "
            f"withhold part of a nested serializer, declare it on that serializer."
        )
    dotted_deprecations = sorted(path for path in deprecate if "." in path)
    if dotted_deprecations:
        raise ValueError(
            f"deprecate[{dotted_deprecations[0]!r}] must name a whole field. The generated "
            f"enum cannot mark one choice, and a nested field is deprecated on its own "
            f"serializer."
        )

    def decorator(klass: T) -> T:
        if _is_response_serializer(klass):
            returned = _returned_type_name(klass)
            raise ValueError(
                f"{klass.__name__} is a response Serializer, so its schema is the TypedDict "
                f"its serialize() returns. Field omissions are declared on the class that "
                f"defines the field: move this decorator to {returned or 'that TypedDict'}."
            )
        choice_paths = _deep(omit_from_public_schema)
        if choice_paths and not issubclass(klass, BaseSerializer):
            raise ValueError(
                f"{klass.__name__} declares {choice_paths[0]!r}, but only a serializer has the "
                f"choice fields such a path is resolved against."
            )
        declared_fields = getattr(klass, "_declared_fields", {})
        for path in choice_paths:
            field_name, _, rest = path.partition(".")
            nested = _descend(declared_fields.get(field_name))
            if nested is not None:
                raise ValueError(nested_field_message(path, type(nested).__name__, rest))
        _merge_reasons(klass, OMISSION_REASONS_OVERRIDE, omit_from_public_schema)
        _merge_reasons(klass, DEPRECATION_REASONS_OVERRIDE, deprecate)

        # A field is dropped natively by drf-spectacular. A choice is withheld by
        # SentrySchema while mapping this serializer.
        _merge_native(klass, "exclude_fields", _shallow(omit_from_public_schema))
        _merge_native(klass, "deprecate_fields", _shallow(deprecate))
        if deprecate_fields:
            _merge_native(klass, "deprecate_fields", list(deprecate_fields))
        return klass

    return decorator


def _shallow(declared: dict[str, str]) -> list[str]:
    return [path for path in declared if "." not in path]


def _deep(declared: dict[str, str]) -> list[str]:
    return sorted(path for path in declared if "." in path)


def _is_response_serializer(klass: type) -> bool:
    # Matched by name: importing sentry.api.serializers.base here would load models.
    return any(
        base.__module__ == "sentry.api.serializers.base" and base.__name__ == "Serializer"
        for base in getattr(klass, "__mro__", ())
    )


def _returned_type_name(klass: type) -> str | None:
    """The name of what serialize() is typed to return, when it can be resolved yet."""
    try:
        returned = get_type_hints(klass.serialize).get("return")  # type: ignore[attr-defined]
    except (NameError, TypeError, AttributeError):
        return None
    return getattr(returned, "__name__", None)


def _merge_native(klass: type, key: str, values: Sequence[str]) -> None:
    """Merge rather than replace: a stacked decorator or a base class may have
    set this already, and subclasses inherit the override."""
    if not values:
        return
    existing = get_override(klass, key, []) or []
    set_override(klass, key, list(dict.fromkeys([*existing, *values])))


def _merge_reasons(klass: type, key: str, declared: dict[str, str]) -> None:
    if not declared:
        return
    reasons = {**(get_override(klass, key, {}) or {})}
    reasons.update(declared)
    set_override(klass, key, reasons)
