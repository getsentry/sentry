"""
Declarative ``?expand=`` / ``?collapse=`` response shaping.

Many serializers accept ``expand`` and ``collapse`` lists that add or remove
response fields. Historically each serializer checked ``key in self.expand``
against string literals scattered through ``serialize``, so the set of accepted
values, and which response fields each one toggled, existed nowhere in one
place. A serializer now declares them once::

    class TeamSerializer(Serializer[TeamSerializerResponse]):
        shaping = ResponseShaping(
            expand={"projects": ("projects",), "externalTeams": ("externalTeams",)},
        )

and reads them through ``self._expand(key)`` / ``self._collapse(key)``, which
refuse a key the declaration does not list. The declarations feed the OpenAPI
``expand``/``collapse`` parameter enums and the ``x-sentry-expand`` /
``x-sentry-collapse`` operation extensions that tell API consumers which
response fields each value controls.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass, field
from types import UnionType
from typing import (
    TYPE_CHECKING,
    Any,
    Literal,
    Union,
    get_args,
    get_origin,
    get_type_hints,
    is_typeddict,
)

from sentry.utils.env import in_test_environment

if TYPE_CHECKING:
    from sentry.api.serializers.base import Serializer

logger = logging.getLogger(__name__)

ShapingKind = Literal["expand", "collapse"]
SHAPING_KINDS: tuple[ShapingKind, ...] = ("expand", "collapse")

# Response fields a shaping key maps to. An empty tuple is allowed for keys
# that change how existing fields are rendered rather than adding or removing
# any (documented on the serializer that declares them).
Fields = tuple[str, ...]


class UndeclaredShapingKey(LookupError):
    """A serializer checked an ``expand``/``collapse`` key it does not declare."""


@dataclass(frozen=True)
class ResponseShaping:
    """
    The ``?expand=`` and ``?collapse=`` values a serializer honours, each mapped
    to the response fields it adds (expand) or removes or reduces (collapse).
    """

    expand: Mapping[str, Fields] = field(default_factory=dict)
    collapse: Mapping[str, Fields] = field(default_factory=dict)

    @property
    def expand_keys(self) -> tuple[str, ...]:
        return tuple(sorted(self.expand))

    @property
    def collapse_keys(self) -> tuple[str, ...]:
        return tuple(sorted(self.collapse))

    def keys(self, kind: ShapingKind) -> tuple[str, ...]:
        return tuple(sorted(self.mapping(kind)))

    def mapping(self, kind: ShapingKind) -> Mapping[str, Fields]:
        return self.expand if kind == "expand" else self.collapse

    def fields(self) -> frozenset[str]:
        """Every response field some key toggles."""
        return frozenset(
            name
            for mapping in (self.expand, self.collapse)
            for names in mapping.values()
            for name in names
        )

    def extend(
        self,
        *,
        expand: Mapping[str, Fields] | None = None,
        collapse: Mapping[str, Fields] | None = None,
    ) -> ResponseShaping:
        """A shaping with more keys, for a subclass that honours everything its base does."""
        return ResponseShaping(
            expand={**self.expand, **(expand or {})},
            collapse={**self.collapse, **(collapse or {})},
        )

    def merge(self, other: ResponseShaping) -> ResponseShaping:
        """The union of two shapings; a key present in both maps to the union of its fields."""
        return ResponseShaping(
            expand=_merge_mappings(self.expand, other.expand),
            collapse=_merge_mappings(self.collapse, other.collapse),
        )

    def as_dict(self) -> dict[str, dict[str, list[str]]]:
        """A JSON-friendly form, keys sorted, for the OpenAPI extensions."""
        return {
            kind: {key: list(self.mapping(kind)[key]) for key in self.keys(kind)}
            for kind in SHAPING_KINDS
            if self.mapping(kind)
        }


def _merge_mappings(a: Mapping[str, Fields], b: Mapping[str, Fields]) -> dict[str, Fields]:
    merged = dict(a)
    for key, names in b.items():
        merged[key] = tuple(dict.fromkeys((*merged.get(key, ()), *names)))
    return merged


def is_requested(serializer: Any, kind: ShapingKind, key: str) -> bool:
    """
    Whether ``key`` was requested through the serializer's ``expand`` /
    ``collapse`` attribute. ``None`` (the parameter was not given) means no key
    is requested, matching the historical per-serializer helpers.

    The key must be declared in the serializer's ``shaping``; an undeclared key
    raises in tests and is logged once elsewhere, so a typo cannot silently
    disable a branch.
    """
    shaping = get_response_shaping(type(serializer))
    if shaping is None or key not in shaping.mapping(kind):
        _report_undeclared(type(serializer), kind, key)
    requested: Iterable[str] | None = getattr(serializer, kind, None)
    return requested is not None and key in requested


_reported: set[tuple[type, str, str]] = set()


def _report_undeclared(serializer_cls: type, kind: ShapingKind, key: str) -> None:
    message = (
        f"{serializer_cls.__name__} checks {kind}={key!r} but its `shaping` does not declare it"
    )
    if in_test_environment():
        raise UndeclaredShapingKey(message)
    marker = (serializer_cls, kind, key)
    if marker not in _reported:
        _reported.add(marker)
        logger.warning(
            "serializer.shaping.undeclared",
            extra={"serializer": serializer_cls.__name__, "kind": kind, "key": key},
        )


def get_response_shaping(serializer_cls: type) -> ResponseShaping | None:
    """The shaping a serializer class declares (or inherits), if any."""
    shaping = getattr(serializer_cls, "shaping", None)
    return shaping if isinstance(shaping, ResponseShaping) else None


def all_response_shapings() -> dict[type[Serializer[Any]], ResponseShaping]:
    """
    Every imported serializer with a shaping, mapped to it. Subclasses that
    inherit a declaration are included, since they honour the same keys.
    """
    from sentry.api.serializers.base import Serializer

    found: dict[type[Serializer[Any]], ResponseShaping] = {}
    for cls in _walk_subclasses(Serializer):
        shaping = get_response_shaping(cls)
        if shaping is not None:
            found[cls] = shaping
    return found


def _walk_subclasses(cls: type) -> Iterator[type]:
    seen: set[type] = set()
    stack = [cls]
    while stack:
        current = stack.pop()
        for sub in current.__subclasses__():
            if sub not in seen:
                seen.add(sub)
                stack.append(sub)
                yield sub


def response_type_of(serializer_cls: type) -> type | None:
    """
    The TypedDict a serializer's ``serialize`` returns, from its return
    annotation or its ``Serializer[T]`` parameter. ``None`` when the shape is
    not declared as a TypedDict (or its annotation cannot be resolved).
    """
    try:
        hints = get_type_hints(serializer_cls.serialize)
    except Exception:
        hints = {}
    candidate = unwrap_response_type(hints.get("return"))
    if candidate is not None:
        return candidate
    for base in getattr(serializer_cls, "__orig_bases__", ()):
        for arg in get_args(base):
            candidate = unwrap_response_type(arg)
            if candidate is not None:
                return candidate
    return None


def unwrap_response_type(hint: Any) -> type | None:
    """``list[T]``, ``Sequence[T]`` and ``T | None`` all describe ``T``; return it when it is a TypedDict."""
    if hint is None:
        return None
    if is_typeddict(hint):
        return hint
    origin = get_origin(hint)
    if origin is None:
        return None
    if origin is Union or origin is UnionType:
        typed = [t for t in (unwrap_response_type(a) for a in get_args(hint)) if t is not None]
        return typed[0] if len(typed) == 1 else None
    args = get_args(hint)
    if args:
        return unwrap_response_type(args[0])
    return None


def shaping_for_response_type(hint: Any) -> ResponseShaping | None:
    """
    The combined shaping of every serializer that produces ``hint`` (a
    TypedDict, or a list/optional of one). Used by the OpenAPI build to attach
    expand/collapse information to a response schema.
    """
    response_type = unwrap_response_type(hint)
    if response_type is None:
        return None
    combined: ResponseShaping | None = None
    for serializer_cls, shaping in all_response_shapings().items():
        if response_type_of(serializer_cls) is response_type:
            combined = shaping if combined is None else combined.merge(shaping)
    return combined
