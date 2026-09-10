"""Withholding part of a serializer from the public API schema. Omitted parts
vanish from every generated SDK but are still accepted at runtime.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import TypeVar

from drf_spectacular.drainage import get_override, set_override

from sentry.apidocs.omission_paths import parse_path

# Override keys holding ``{path: reason}``. Read by the postprocessing hook and
# by the linter; drf-spectacular itself ignores them.
OMISSION_REASONS_OVERRIDE = "sentry_omission_reasons"
DEPRECATION_REASONS_OVERRIDE = "sentry_deprecation_reasons"

# Classes carrying a declaration. A serializer used only for query parameters
# never becomes a component, so the schema build cannot find it any other way.
DECLARING_SERIALIZERS: list[type] = []

T = TypeVar("T", bound=type)


def _check_reasons(declared: dict[str, str], keyword: str, remedy: str) -> None:
    """Every path is well formed and carries a reason."""
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

    Keys are dotted paths; ``deprecate_fields`` is the older list form.
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

    def decorator(klass: T) -> T:
        if klass not in DECLARING_SERIALIZERS:
            DECLARING_SERIALIZERS.append(klass)
        _merge_reasons(klass, OMISSION_REASONS_OVERRIDE, omit_from_public_schema)
        _merge_reasons(klass, DEPRECATION_REASONS_OVERRIDE, deprecate)

        # One segment names a field, which drf-spectacular handles natively.
        # Deeper paths and choice values are applied while postprocessing.
        _merge_native(klass, "exclude_fields", _shallow(omit_from_public_schema))
        _merge_native(klass, "deprecate_fields", _shallow(deprecate))
        if deprecate_fields:
            _merge_native(klass, "deprecate_fields", list(deprecate_fields))
        return klass

    return decorator


def _shallow(declared: dict[str, str]) -> list[str]:
    return [path for path in declared if "." not in path]


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
