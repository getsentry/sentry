"""
A small vocabulary for declaring the shape of a symbol source.

A source kind is declared as named fields. From those, the JSON schema used
for validation, the redacted schema used in API responses, and the API docs
are all derived, so they cannot drift apart.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

HIDDEN_SECRET = {"hidden-secret": True}
HIDDEN_SECRET_SCHEMA = {
    "type": "object",
    "properties": {"hidden-secret": {"type": "boolean", "enum": [True]}},
}


@dataclass(frozen=True)
class Field:
    """
    One property of a symbol source.

    `schema` is the JSON schema of the value. `description` is shown in the
    API docs; a field without one is accepted but not documented.
    """

    schema: Mapping[str, Any]
    description: str | None = None
    required: bool = False
    secret: bool = False

    def json_schema(self, *, redacted: bool = False) -> dict[str, Any]:
        schema = dict(HIDDEN_SECRET_SCHEMA if redacted and self.secret else self.schema)
        if self.description:
            schema["description"] = self.description
        return schema


def string(description: str | None, *, required: bool = False, secret: bool = False) -> Field:
    return Field({"type": "string"}, description, required, secret)


def boolean(description: str | None) -> Field:
    return Field({"type": "boolean"}, description)


def strings(description: str | None) -> Field:
    return Field({"type": "array", "items": {"type": "string"}}, description)


def choice(
    description: str, options: Iterable[StrEnum], *, required: bool = False, many: bool = False
) -> Field:
    schema: dict[str, Any] = {"type": "string", "enum": [option.value for option in options]}
    if many:
        schema = {"type": "array", "items": schema}
    return Field(schema, description, required)


def nested(description: str, *, required: bool = False, **fields: Field) -> Field:
    return Field(object_schema(fields), description, required)


def object_schema(fields: Mapping[str, Field], *, redacted: bool = False) -> dict[str, Any]:
    schema: dict[str, Any] = {
        "type": "object",
        "properties": {
            name: field.json_schema(redacted=redacted) for name, field in fields.items()
        },
        "additionalProperties": False,
    }
    if required := [name for name, field in fields.items() if field.required]:
        schema["required"] = required
    return schema
