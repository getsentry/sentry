"""Withholding a serializer field from the public API schema.

Omitted fields vanish from the generated schema and every generated SDK, but are
still accepted at runtime. A missing description is not a reason to use this --
add help_text instead; sentry.apidocs.hooks spells out when omission is correct.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import TypeVar

from drf_spectacular.drainage import get_override, set_override

# Override key holding ``{field: reason}``. Read by the linter and by anything
# reporting on the public surface; drf-spectacular itself ignores it.
OMISSION_REASONS_OVERRIDE = "sentry_omission_reasons"

T = TypeVar("T", bound=type)


def sentry_schema_serializer(
    *, omit_from_public_schema: dict[str, str], deprecate_fields: Sequence[str] | None = None
) -> Callable[[T], T]:
    """Withhold fields from the generated schema, recording why for each one.

    Each value is the reason that field is not part of the public API surface.
    ``deprecate_fields`` is passed through to drf-spectacular unchanged.
    """
    if not omit_from_public_schema:
        raise ValueError(
            "sentry_schema_serializer() requires at least one field in "
            "omit_from_public_schema; remove the decorator instead."
        )

    for field, reason in omit_from_public_schema.items():
        if not reason or not reason.strip():
            raise ValueError(
                f"omit_from_public_schema['{field}'] needs a reason explaining why the "
                f"field is not part of the public API surface. If the field is simply "
                f"undocumented, add a help_text to it instead of omitting it."
            )

    def decorator(klass: T) -> T:
        # Merge rather than replace: a class may carry exclude_fields from a
        # stacked @extend_schema_serializer, and subclasses inherit the override.
        existing = get_override(klass, "exclude_fields", []) or []
        merged = list(dict.fromkeys([*existing, *omit_from_public_schema]))
        set_override(klass, "exclude_fields", merged)

        reasons = {**(get_override(klass, OMISSION_REASONS_OVERRIDE, {}) or {})}
        reasons.update(omit_from_public_schema)
        set_override(klass, OMISSION_REASONS_OVERRIDE, reasons)

        if deprecate_fields:
            existing_deprecated = get_override(klass, "deprecate_fields", []) or []
            set_override(
                klass,
                "deprecate_fields",
                list(dict.fromkeys([*existing_deprecated, *deprecate_fields])),
            )
        return klass

    return decorator
