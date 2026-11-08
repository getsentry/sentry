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
from collections.abc import Mapping
from functools import cache
from pathlib import Path
from typing import Any

import sentry_kafka_schemas

from sentry.apidocs.response_coverage import CYCLE

_DEFINITION_PREFIX = "#/definitions/"
_JSON_TYPES = {str: "string", bool: "boolean", int: "integer", float: "number"}
_NULL = {"type": "object", "nullable": True, "enum": [None]}
_DROPPED_KEYWORDS = frozenset({"$schema", "$ref", "title", "definitions", "if", "then", "else"})


class UndescribedPropertyError(ValueError):
    pass


def to_response_schema(
    schema: Mapping[str, Any],
    *,
    definitions: Mapping[str, Any] | None = None,
    descriptions: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    """
    Converts a JSON Schema (draft 7 or earlier) to an OpenAPI 3.0 response schema.

    `#/definitions/` references are inlined. A definition that refers back to itself is
    cut short with a cycle marker, the way a recursive TypedDict is.
    """
    definitions = definitions if definitions is not None else schema.get("definitions", {})
    descriptions = descriptions or {}
    in_progress: list[str] = []

    def described(value: dict[str, Any], key: str, ref: Mapping[str, Any]) -> dict[str, Any]:
        if value.get("description"):
            return value
        text = descriptions.get(key) or _referenced_description(ref, definitions)
        if not text:
            raise UndescribedPropertyError(
                f"{key} has no description; add one to the descriptions passed to "
                "to_response_schema"
            )
        return {**value, "description": text}

    def convert(value: Mapping[str, Any], owner: str) -> dict[str, Any]:
        ref = value.get("$ref")
        if isinstance(ref, str):
            if not ref.startswith(_DEFINITION_PREFIX):
                raise ValueError(f"Unsupported reference {ref}")
            target = ref[len(_DEFINITION_PREFIX) :]
            if target in in_progress:
                return _cycle_placeholder(target, definitions[target])
            in_progress.append(target)
            try:
                resolved = convert(definitions[target], target)
            finally:
                in_progress.pop()
            siblings = {k: v for k, v in value.items() if k not in _DROPPED_KEYWORDS}
            return {**resolved, **siblings}

        result: dict[str, Any] = {}
        for key, item in value.items():
            if key in _DROPPED_KEYWORDS or key == "properties":
                continue
            if key in ("items", "additionalProperties", "not") and isinstance(item, dict):
                result[key] = convert(item, owner)
            elif key in ("anyOf", "oneOf", "allOf"):
                result[key] = [convert(branch, owner) for branch in item]
            else:
                result[key] = item

        if isinstance(properties := value.get("properties"), dict):
            result["properties"] = {
                prop: described(convert(spec, owner), f"{owner}.{prop}", spec)
                for prop, spec in properties.items()
            }
        if "const" in result:
            result["enum"] = [result.pop("const")]
        _move_null_to_nullable(result)
        return result

    # Later steps edit schemas in place, such as adding null to a nullable enum, so the
    # result must not share lists or dicts with the cached JSON Schema or with itself.
    return copy.deepcopy(convert(schema, ""))


def _referenced_description(spec: Mapping[str, Any], definitions: Mapping[str, Any]) -> str | None:
    """The description of the definition a property refers to, directly or as `X | null`."""
    candidates = [spec, *spec.get("oneOf", ()), *spec.get("anyOf", ())]
    for candidate in candidates:
        ref = candidate.get("$ref")
        if isinstance(ref, str) and ref.startswith(_DEFINITION_PREFIX):
            text = definitions.get(ref[len(_DEFINITION_PREFIX) :], {}).get("description")
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
        else:
            result.pop("type")
            if non_null:
                result["anyOf"] = [{"type": kind} for kind in non_null]
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
        {"$ref": f"{_DEFINITION_PREFIX}{definition}"},
        definitions=schema["definitions"],
        descriptions=descriptions,
    )
