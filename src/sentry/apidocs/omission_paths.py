"""Naming a withheld part of the public schema: a dotted path resolved against
a serializer's fields, each field's class deciding what may follow it.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from rest_framework import serializers

# What a resolved path points at. A value can be withheld but not deprecated,
# because the generated enum has nowhere to carry per-entry metadata.
FIELD = "field"
VALUE = "value"


class PathError(ValueError):
    """A path that cannot be parsed, or does not name anything."""


@dataclass(frozen=True)
class Resolved:
    """Where a path landed: the segments walked, and what the last one names."""

    segments: tuple[str, ...]
    kind: str
    # Withholding the value a field falls back to says the default is going
    # away, so the parameter must be sent explicitly and declares no default.
    withholds_default: bool = False


def parse_path(path: str) -> tuple[str, ...]:
    """Split a dotted path, rejecting empty segments."""
    if not path or not path.strip():
        raise PathError("a path cannot be empty")
    segments = path.split(".")
    for segment in segments:
        if not segment.strip():
            raise PathError(
                f"{path!r} has an empty segment; write 'field', 'field.nested', "
                f"or 'field.choice' with no leading, trailing or doubled dots."
            )
    return tuple(segments)


def _choices_of(field: Any) -> set[str] | None:
    """Choice values of a field, or None when it has none."""
    choices = getattr(field, "choices", None)
    if choices is None:
        return None
    return {str(choice) for choice in choices}


def _descend(field: Any) -> Any | None:
    """The serializer a segment descends into, skipping a list's child."""
    if isinstance(field, serializers.ListField):
        field = field.child
    if isinstance(field, serializers.ListSerializer):
        field = field.child
    return field if isinstance(field, serializers.BaseSerializer) else None


def _fields_of(node: Any) -> dict[str, Any] | None:
    try:
        return dict(node.fields)
    except Exception:
        return None


def resolve(serializer: Any, path: str) -> Resolved:
    """Walk `path` against a constructed serializer, or raise PathError.

    Choices come from the built field, so a computed set resolves normally.
    """
    segments = parse_path(path)
    node: Any = serializer
    for index, segment in enumerate(segments):
        walked = ".".join(segments[: index + 1])
        fields = _fields_of(node)
        if fields is None:
            raise PathError(
                f"{path!r}: {'.'.join(segments[:index])!r} has no fields to descend into"
            )
        if segment not in fields:
            raise PathError(
                f"{path!r}: {walked!r} names nothing on "
                f"{type(node).__name__}; it withholds nothing and should be deleted"
            )
        field = fields[segment]
        remaining = segments[index + 1 :]
        if not remaining:
            return Resolved(segments, FIELD)

        # One more segment to place: the field's class decides what it can be.
        nested = _descend(field)
        if nested is not None:
            node = nested
            continue
        choices = _choices_of(_unwrap_list(field))
        if choices is not None:
            if len(remaining) > 1:
                raise PathError(f"{path!r}: a choice value has no parts to address")
            value = remaining[0]
            if value not in choices:
                raise PathError(
                    f"{path!r}: {walked!r} does not accept {value!r}; it withholds "
                    f"nothing and should be deleted"
                )
            return Resolved(segments, VALUE, withholds_default=_is_default(field, value))
        if isinstance(field, (serializers.JSONField, serializers.DictField)):
            raise PathError(
                f"{path!r}: {walked!r} holds a dynamic mapping, so its contents "
                f"are not statically addressable"
            )
        raise PathError(
            f"{path!r}: {walked!r} is a {type(field).__name__} and has no addressable parts"
        )
    raise PathError(f"{path!r} resolved to nothing")


def _is_default(field: Any, value: str) -> bool:
    default = getattr(_unwrap_list(field), "default", None)
    return default is not None and str(default) == value


def _unwrap_list(field: Any) -> Any:
    """A list's child, so `sort.-age` reaches a ListField(child=ChoiceField)."""
    if isinstance(field, serializers.ListField):
        return field.child
    return field


def resolve_all(serializer: Any, paths: Sequence[str]) -> dict[str, Resolved]:
    """Resolve every path, collecting failures into one error."""
    resolved: dict[str, Resolved] = {}
    errors: list[str] = []
    for path in paths:
        try:
            resolved[path] = resolve(serializer, path)
        except PathError as exc:
            errors.append(str(exc))
    if errors:
        raise PathError("; ".join(errors))
    return resolved
