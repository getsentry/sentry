"""
Response schemas built from JSON Schemas that the code already validates data against.

A TypedDict field whose shape is pinned down by a JSON Schema, such as the uptime
assertion that sentry-kafka-schemas defines, uses that schema instead of a hand-written
copy, so the two can't drift:

    class UptimeSubscriptionSerializerResponse(TypedDict):
        assertion: Annotated[
            Assertion | None, ApiDescription("..."), ApiSchema(_assertion_schema)
        ]

Every object property in the result needs a description, which the response coverage
check enforces. JSON Schemas often leave them out, so `descriptions` fills them in,
keyed by `<definition>.<property>`. A property without one raises, so a new property
upstream fails the build until it's described here.
"""

from __future__ import annotations

import copy
import json  # noqa: S003
import os
from collections.abc import Iterable, Mapping
from functools import cache
from pathlib import Path
from typing import Any

import sentry_kafka_schemas

from sentry.api.serializers.rest_framework.base import snake_to_camel_case
from sentry.apidocs.response_coverage import CYCLE

_DEFINITION_PREFIXES = ("#/definitions/", "#/$defs/")
_JSON_TYPES = {str: "string", bool: "boolean", int: "integer", float: "number"}
_NULL = {"type": "object", "nullable": True, "enum": [None]}
# `optional` isn't a JSON Schema keyword, but some schemas use it as a note.
_DROPPED_KEYWORDS = frozenset(
    {"$schema", "$id", "$ref", "title", "definitions", "$defs", "if", "then", "else", "optional"}
)
_VALIDATION_ONLY_KEYWORDS = frozenset({"anyOf", "oneOf", "allOf", "not"})


class UndescribedPropertyError(ValueError):
    pass


def to_response_schema(
    schema: Mapping[str, Any],
    *,
    definitions: Mapping[str, Any] | None = None,
    descriptions: Mapping[str, str] | None = None,
    camel_case: bool = False,
) -> dict[str, Any]:
    """
    Converts a JSON Schema to an OpenAPI 3.0 response schema.

    `#/definitions/` and `#/$defs/` references are inlined. A definition that refers back
    to itself is cut short with a cycle marker, the way a recursive TypedDict is.

    A property's description comes from the schema, then from `descriptions` keyed by its
    path, such as `<definition>.<property>` or `filters[].key`, then by its bare name. Set `camel_case` when the
    response camelCases the keys of the validated data.
    """
    if definitions is None:
        definitions = {**schema.get("definitions", {}), **schema.get("$defs", {})}
    descriptions = descriptions or {}
    in_progress: list[str] = []
    rename = snake_to_camel_case if camel_case else str

    def described(value: dict[str, Any], key: str, ref: Mapping[str, Any]) -> dict[str, Any]:
        if value.get("description"):
            return value
        text = (
            descriptions.get(key)
            or descriptions.get(key.rsplit(".", 1)[-1])
            or _referenced_description(ref, definitions)
        )
        if not text:
            raise UndescribedPropertyError(
                f"{key} has no description; add one to the descriptions passed to "
                "to_response_schema"
            )
        return {**value, "description": text}

    def convert(value: Mapping[str, Any], path: str) -> dict[str, Any]:
        ref = value.get("$ref")
        if isinstance(ref, str):
            target = _definition_name(ref)
            if target in in_progress:
                return _cycle_placeholder(target, definitions[target])
            in_progress.append(target)
            try:
                resolved = convert(definitions[target], target)
            finally:
                in_progress.pop()
            siblings = {k: v for k, v in value.items() if k not in _DROPPED_KEYWORDS}
            return {**resolved, **siblings}

        properties = value.get("properties")
        # Next to properties, these only add validation rules, such as which properties
        # are required together, and don't change the shape.
        skipped = _VALIDATION_ONLY_KEYWORDS if isinstance(properties, dict) else frozenset()
        result: dict[str, Any] = {}
        for key, item in value.items():
            if key in _DROPPED_KEYWORDS or key in skipped or key == "properties":
                continue
            if key in ("items", "additionalProperties", "not") and isinstance(item, dict):
                result[key] = convert(item, f"{path}[]" if key == "items" else path)
            elif key == "items" and isinstance(item, list):
                # OpenAPI 3.0 has no tuples, so each item can be any of the tuple's types.
                result[key] = union_schema(convert(branch, f"{path}[]") for branch in item)
            elif key in ("anyOf", "oneOf", "allOf"):
                result[key] = [convert(branch, path) for branch in item]
            else:
                result[key] = item

        if isinstance(properties, dict):
            result["properties"] = {}
            for prop, spec in properties.items():
                key = f"{path}.{prop}".lstrip(".")
                result["properties"][rename(prop)] = described(convert(spec, key), key, spec)
        if isinstance(required := value.get("required"), list):
            result["required"] = [rename(prop) for prop in required]
        if result.get("additionalProperties") is False and not result.get("properties"):
            # The same marker an empty TypedDict gets, so the object counts as typed.
            result["maxProperties"] = 0
        if "const" in result:
            result["enum"] = [result.pop("const")]
        _move_null_to_nullable(result)
        return result

    # Later steps edit schemas in place, such as adding null to a nullable enum, so the
    # result must not share lists or dicts with the cached JSON Schema or with itself.
    return copy.deepcopy(convert(schema, ""))


def _definition_name(ref: str) -> str:
    for prefix in _DEFINITION_PREFIXES:
        if ref.startswith(prefix):
            return ref[len(prefix) :]
    raise ValueError(f"Unsupported reference {ref}")


def union_schema(schemas: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
    """`anyOf` the distinct schemas, such as one per handler in a registry."""
    distinct: dict[str, Mapping[str, Any]] = {}
    for schema in schemas:
        nested = schema["anyOf"] if list(schema) == ["anyOf"] else [schema]
        for branch in nested:
            distinct.setdefault(json.dumps(branch, sort_keys=True), branch)
    branches = [copy.deepcopy(dict(schema)) for schema in distinct.values()]
    return branches[0] if len(branches) == 1 else {"anyOf": branches}


def _referenced_description(spec: Mapping[str, Any], definitions: Mapping[str, Any]) -> str | None:
    """The description of the definition a property refers to, directly or as `X | null`."""
    candidates = [spec, *spec.get("oneOf", ()), *spec.get("anyOf", ())]
    for candidate in candidates:
        ref = candidate.get("$ref")
        if isinstance(ref, str):
            text = definitions.get(_definition_name(ref), {}).get("description")
            if text:
                return str(text)
    return None


def _move_null_to_nullable(result: dict[str, Any]) -> None:
    """OpenAPI 3.0 has no `null` type, so `X | null` becomes `X` with `nullable`."""
    if isinstance(types := result.get("type"), list):
        non_null = [kind for kind in types if kind != "null"]
        if "null" in types:
            result["nullable"] = True
        if len(non_null) == 1:
            result["type"] = non_null[0]
        elif non_null:
            result.pop("type")
            result["anyOf"] = [{"type": kind} for kind in non_null]
        else:
            result.update(_NULL)
    for combinator in ("oneOf", "anyOf"):
        branches = result.get(combinator)
        if not isinstance(branches, list):
            continue
        non_null = [branch for branch in branches if branch.get("type") != "null"]
        if len(non_null) == len(branches):
            continue
        result["nullable"] = True
        if len(non_null) == 1:
            result.pop(combinator)
            result.update({k: v for k, v in non_null[0].items() if k not in result})
        else:
            result[combinator] = non_null
    if result.get("nullable") and "type" not in result:
        # Validators reject `nullable` without a `type`.
        enum_types = {_JSON_TYPES.get(type(value)) for value in result.get("enum", [None])}
        union_key = next((key for key in ("anyOf", "oneOf") if key in result), None)
        enum_type = enum_types.pop() if len(enum_types) == 1 else None
        if enum_type is not None:
            result["type"] = enum_type
        elif union_key is not None:
            # The same stand-in for null that resolve_type_hint adds to a union.
            result.pop("nullable")
            result[union_key] = [*result[union_key], _NULL]
        else:
            raise ValueError(f"Can't tell the type of nullable schema {result}")


def _cycle_placeholder(name: str, definition: Mapping[str, Any]) -> dict[str, Any]:
    placeholder: dict[str, Any] = {
        "type": "object",
        "description": f"{definition.get('description') or name}. "
        "Its fields are the same as the one this is inside, so they're left out here.",
    }
    if os.environ.get("OPENAPIGENERATE"):
        # Read by the response coverage check; the deref step strips it.
        placeholder[CYCLE] = True
    return placeholder


@cache
def _kafka_json_schema(topic: str) -> dict[str, Any]:
    """The JSON Schema of the latest version of a sentry-kafka-schemas topic."""
    resource = sentry_kafka_schemas.get_topic(topic)["schemas"][-1]["resource"]
    path = Path(sentry_kafka_schemas.__file__).parent / "schemas" / resource
    return json.loads(path.read_text())


def kafka_definition_schema(
    topic: str, definition: str, descriptions: Mapping[str, str] | None = None
) -> dict[str, Any]:
    """A response schema for one definition of a sentry-kafka-schemas topic."""
    schema = _kafka_json_schema(topic)
    return to_response_schema(
        {"$ref": f"{_DEFINITION_PREFIXES[0]}{definition}"},
        definitions=schema["definitions"],
        descriptions=descriptions,
    )
