"""Proving a schema build's omissions changed only what they declare.

The docs build generates twice, once with omissions switched off, and compares
the two by name. Every difference must belong to an omission recorded where
drf-spectacular placed the serializer or TypedDict declaring it.
"""

from __future__ import annotations

import contextlib
from collections.abc import Iterator, Mapping, Set
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from sentry.apidocs.omission_apply import (
    _ABSENT,
    OmissionError,
    _differences,
    _shown,
    _without_choice_lines,
)
from sentry.apidocs.omission_paths import Resolved

# ("components", component name) or ("operations", operationId).
Location = tuple[str, str]
# Keys leading from a location's schema to a nested object, e.g. ("properties", "owner").
Pointer = tuple[str, ...]

_HTTP_METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}
_REF_PREFIX = "#/components/schemas/"
_LISTED = 20


@dataclass
class Declared:
    """Everything declared by the serializers and TypedDicts placed at one location."""

    omitted: set[str] = field(default_factory=set)
    deprecated: set[str] = field(default_factory=set)
    withheld: dict[str, set[str]] = field(default_factory=dict)
    defaults: set[str] = field(default_factory=set)
    # Fields omitted by a TypedDict inlined at each pointer within the location.
    nested: dict[Pointer, set[str]] = field(default_factory=dict)


class _Disabled:
    pass


_DISABLED = _Disabled()
_mode: ContextVar[dict[Location, Declared] | _Disabled | None] = ContextVar(
    "sentry_apidocs_omission_mode", default=None
)
_placement: ContextVar[Location | None] = ContextVar(
    "sentry_apidocs_omission_placement", default=None
)
_pointer: ContextVar[Pointer] = ContextVar("sentry_apidocs_omission_pointer", default=())


def omissions_enabled() -> bool:
    return not isinstance(_mode.get(), _Disabled)


@contextlib.contextmanager
def omissions_disabled() -> Iterator[None]:
    token = _mode.set(_DISABLED)
    try:
        yield
    finally:
        _mode.reset(token)


@contextlib.contextmanager
def recording_omissions() -> Iterator[dict[Location, Declared]]:
    recorded: dict[Location, Declared] = {}
    token = _mode.set(recorded)
    try:
        yield recorded
    finally:
        _mode.reset(token)


@contextlib.contextmanager
def placed_at(location: Location) -> Iterator[None]:
    """Serializers mapped inside this block land at the root of `location`."""
    placement, pointer = _placement.set(location), _pointer.set(())
    try:
        yield
    finally:
        _pointer.reset(pointer)
        _placement.reset(placement)


@contextlib.contextmanager
def descended(*keys: str) -> Iterator[None]:
    """A type hint resolved inside this block lands at `keys` below the current pointer."""
    token = _pointer.set((*_pointer.get(), *keys))
    try:
        yield
    finally:
        _pointer.reset(token)


def record(
    serializer: str,
    omitted: Set[str],
    deprecated: Set[str],
    rules: Mapping[str, Resolved],
) -> None:
    """Note what a serializer declared at the location it is being mapped into."""
    declared = _declared_here(serializer, bool(omitted or deprecated or rules))
    if declared is None:
        return
    declared.omitted |= omitted
    declared.deprecated |= deprecated
    for rule in rules.values():
        field_name, value = rule.segments
        declared.withheld.setdefault(field_name, set()).add(value)
        if rule.withholds_default:
            declared.defaults.add(field_name)


def record_typed_dict(typed_dict: str, omitted: Set[str]) -> None:
    """Note the fields a TypedDict omits, at the pointer it is being inlined at."""
    declared = _declared_here(typed_dict, bool(omitted))
    if declared is not None:
        declared.nested.setdefault(_pointer.get(), set()).update(omitted)


def _declared_here(declaring: str, declares: bool) -> Declared | None:
    recorded = _mode.get()
    if not isinstance(recorded, dict) or not declares:
        return None
    location = _placement.get()
    if location is None:
        raise OmissionError(
            f"{declaring} declares omissions but was mapped outside any component or "
            f"operation, so the build cannot check where they landed"
        )
    return recorded.setdefault(location, Declared())


def check_schema_omissions(
    baseline: Mapping[str, Any],
    schema: Mapping[str, Any],
    recorded: Mapping[Location, Declared],
) -> None:
    """Raise unless `schema` differs from `baseline` exactly as `recorded` declares."""
    before, after = _keyed(baseline), _keyed(schema)
    unclaimed = [
        f"{'/'.join(key)}: {_shown(old)} -> {_shown(new)}"
        for key, old, new in _differences(before, after)
        if not _claimed(key, old, new, recorded, before, after)
    ]
    if unclaimed:
        raise OmissionError(
            "omissions changed parts of the schema nothing declares:\n  "
            + "\n  ".join(unclaimed[:_LISTED])
        )
    missing = list(_missing(after, recorded))
    if missing:
        raise OmissionError(
            "declared omissions are not in the built schema:\n  " + "\n  ".join(missing[:_LISTED])
        )


def _keyed(document: Mapping[str, Any]) -> dict[str, Any]:
    """The document with operations keyed by operationId and parameters by location and name."""
    operations: dict[str, Any] = {}
    path_items: dict[str, Any] = {}
    for path, item in (document.get("paths") or {}).items():
        path_items[path] = {k: v for k, v in item.items() if k not in _HTTP_METHODS}
        for method, operation in item.items():
            if method not in _HTTP_METHODS:
                continue
            operation_id = operation.get("operationId") or f"{method.upper()} {path}"
            if operation_id in operations:
                raise OmissionError(
                    f"operationId {operation_id!r} is used twice, so the builds cannot be compared"
                )
            parameters = {
                f"{p.get('in')}:{p.get('name')}": p for p in operation.get("parameters", [])
            }
            operations[operation_id] = {
                **operation,
                "parameters": parameters,
                "x-route": f"{method.upper()} {path}",
            }
    rest = {k: v for k, v in document.items() if k != "paths"}
    return {**rest, "paths": path_items, "operations": operations}


def _claimed(
    key: tuple[str, ...],
    old: Any,
    new: Any,
    recorded: Mapping[Location, Declared],
    before: Mapping[str, Any],
    after: Mapping[str, Any],
) -> bool:
    if key[:2] == ("components", "schemas") and len(key) >= 3:
        if len(key) == 3:
            # A component only an omitted field used is no longer generated.
            return new is _ABSENT and not _referenced(after, key[2])
        declared = recorded.get(("components", key[2]))
        if declared is None:
            return False
        if _claimed_in_typed_dict(key[3:], old, new, declared):
            return True
        if len(key) >= 5 and key[3] == "properties" and key[4] in declared.deprecated:
            # Compared as a whole property: drf-spectacular wraps a deprecated $ref in allOf.
            return _marked_deprecated(
                _property(before, key[2], key[4]), _property(after, key[2], key[4])
            )
        return _claimed_in_object(key[3:], old, new, declared)
    if key[:1] == ("operations",) and len(key) >= 4 and key[2] == "parameters":
        declared = recorded.get(("operations", key[1]))
        return declared is not None and _claimed_in_parameter(key[3:], old, new, declared)
    if key[:1] == ("operations",) and key[2:] == ("requestBody", "required"):
        return _body_requirement_followed(key[1], old, new, recorded, before, after)
    return False


def _claimed_in_typed_dict(rest: tuple[str, ...], old: Any, new: Any, declared: Declared) -> bool:
    """A TypedDict's omission removes exactly its own fields at its own pointer."""
    for pointer, omitted in declared.nested.items():
        if rest[: len(pointer)] != pointer:
            continue
        inner = rest[len(pointer) :]
        if len(inner) == 2 and inner[0] == "properties" and inner[1] in omitted:
            return new is _ABSENT
        if inner == ("required",):
            previous = set(old) if isinstance(old, list) else set()
            current = set(new) if isinstance(new, list) else set()
            return bool(previous & omitted) and current == previous - omitted
    return False


def _body_requirement_followed(
    operation_id: str,
    old: Any,
    new: Any,
    recorded: Mapping[Location, Declared],
    before: Mapping[str, Any],
    after: Mapping[str, Any],
) -> bool:
    """drf-spectacular requires a body exactly while its schema has a writable
    required field, so an omission that empties or fills that set flips the body."""
    component = _body_component(after["operations"][operation_id])
    if component is None or ("components", component) not in recorded:
        return False
    was, now = _has_writable_required(before, component), _has_writable_required(after, component)
    return was != now and (old is True) == was and (new is True) == now


def _body_component(operation: Mapping[str, Any]) -> str | None:
    """The one component every media type of the request body points at."""
    content = (operation.get("requestBody") or {}).get("content") or {}
    refs = {(media.get("schema") or {}).get("$ref") for media in content.values()}
    if len(refs) != 1:
        return None
    ref = refs.pop()
    if not isinstance(ref, str) or not ref.startswith(_REF_PREFIX):
        return None
    return ref[len(_REF_PREFIX) :]


def _has_writable_required(document: Mapping[str, Any], name: str) -> bool:
    component = document.get("components", {}).get("schemas", {}).get(name) or {}
    properties = component.get("properties", {})
    return any(
        not (properties.get(required) or {}).get("readOnly")
        for required in component.get("required", [])
    )


def _claimed_in_object(rest: tuple[str, ...], old: Any, new: Any, declared: Declared) -> bool:
    if rest == ("required",):
        previous = set(old) if isinstance(old, list) else set()
        current = set(new) if isinstance(new, list) else set()
        return current == (previous - declared.omitted) | (declared.defaults & (previous | current))
    if len(rest) < 2 or rest[0] != "properties":
        return False
    field_name, inner = rest[1], rest[2:]
    if field_name in declared.omitted:
        return inner == () and new is _ABSENT
    if field_name in declared.withheld:
        return _claimed_choice(
            inner,
            old,
            new,
            declared.withheld[field_name],
            field_name in declared.defaults,
        )
    return False


def _property(document: Mapping[str, Any], component: str, field_name: str) -> Any:
    schema = document.get("components", {}).get("schemas", {}).get(component) or {}
    return (schema.get("properties") or {}).get(field_name, _ABSENT)


def _marked_deprecated(old: Any, new: Any) -> bool:
    """Whether `new` is `old` marked deprecated the way drf-spectacular marks it: a
    sibling key, or for a bare $ref an allOf wrapper, since a $ref ignores siblings."""
    if not isinstance(old, Mapping) or not isinstance(new, Mapping):
        return False
    if set(old) == {"$ref"}:
        return dict(new) == {"allOf": [dict(old)], "deprecated": True}
    return dict(new) == {**old, "deprecated": True}


def _claimed_in_parameter(rest: tuple[str, ...], old: Any, new: Any, declared: Declared) -> bool:
    location, _, field_name = rest[0].partition(":")
    inner = rest[1:]
    if location != "query":
        return False
    if field_name in declared.omitted:
        return inner == () and new is _ABSENT
    if field_name in declared.deprecated:
        return inner == ("deprecated",) and old is _ABSENT and new is True
    if field_name not in declared.withheld:
        return False
    values = declared.withheld[field_name]
    default_withheld = field_name in declared.defaults
    if inner == ("required",):
        return default_withheld and new is True
    if inner == ("description",):
        return isinstance(old, str) and new == _without_choice_lines(old, values)
    if inner[:1] == ("schema",):
        return _claimed_choice(inner[1:], old, new, values, default_withheld)
    return False


def _claimed_choice(
    inner: tuple[str, ...], old: Any, new: Any, values: Set[str], default_withheld: bool
) -> bool:
    if inner[:1] == ("items",):
        inner = inner[1:]
    if inner == ("enum",):
        return isinstance(old, list) and new == [e for e in old if str(e) not in values]
    if inner == ("description",):
        return isinstance(old, str) and new == _without_choice_lines(old, values)
    if inner == ("default",):
        return default_withheld and new is _ABSENT
    return False


def _missing(after: Mapping[str, Any], recorded: Mapping[Location, Declared]) -> Iterator[str]:
    """Declared omissions the finished schema does not show."""
    for (kind, name), declared in sorted(recorded.items()):
        where = f"{kind}/{name}"
        if kind == "components":
            component = after.get("components", {}).get("schemas", {}).get(name)
            if component is None:
                continue
            for pointer, omitted in sorted(declared.nested.items()):
                node = _at(component, pointer)
                present = omitted & set((node or {}).get("properties", {}))
                for field_name in sorted(present):
                    yield f"{where}/{'/'.join(pointer)}: {field_name} is still present"
            schemas = dict(component.get("properties", {}))
            required = component.get("required", [])
            marked = {
                f for f, s in schemas.items() if isinstance(s, Mapping) and s.get("deprecated")
            }
        else:
            operation = after.get("operations", {}).get(name)
            if operation is None:
                continue
            parameters = operation.get("parameters", {})
            schemas = {
                key.partition(":")[2]: parameter.get("schema")
                for key, parameter in parameters.items()
                if key.startswith("query:")
            }
            required = [
                key.partition(":")[2]
                for key, parameter in parameters.items()
                if key.startswith("query:") and parameter.get("required")
            ]
            marked = {
                key.partition(":")[2]
                for key, parameter in parameters.items()
                if key.startswith("query:") and parameter.get("deprecated")
            }
        for field_name in sorted(declared.omitted & set(schemas)):
            yield f"{where}: {field_name} is still present"
        for field_name in sorted(declared.deprecated & set(schemas)):
            if field_name not in marked:
                yield f"{where}: {field_name} is not marked deprecated"
        for field_name, values in sorted(declared.withheld.items()):
            schema = schemas.get(field_name)
            if not isinstance(schema, Mapping):
                continue
            enum = schema.get("enum", (schema.get("items") or {}).get("enum", []))
            for value in sorted(values & {str(entry) for entry in enum}):
                yield f"{where}: {field_name} still offers {value!r}"
        for field_name in sorted(declared.defaults & set(schemas)):
            if field_name not in required:
                yield f"{where}: {field_name} withholds its default but is not required"


def _at(node: Any, pointer: Pointer) -> Mapping[str, Any] | None:
    for key in pointer:
        if not isinstance(node, Mapping):
            return None
        node = node.get(key)
    return node if isinstance(node, Mapping) else None


def _referenced(document: Mapping[str, Any], name: str) -> bool:
    target = f"{_REF_PREFIX}{name}"
    stack: list[Any] = [document]
    while stack:
        node = stack.pop()
        if isinstance(node, Mapping):
            if node.get("$ref") == target:
                return True
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
    return False
