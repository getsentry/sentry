from __future__ import annotations

import logging
from typing import Any

from jsonschema import Draft7Validator
from jsonschema.exceptions import best_match

logger = logging.getLogger(__name__)

METADATA_SCHEMA: dict[str, Any] = {
    "type": "object",
    "definitions": {
        "resource": {
            "type": "object",
            "properties": {"title": {"type": "string"}, "url": {"type": "string", "format": "uri"}},
            "required": ["title", "url"],
            "additionalProperties": False,
        }
    },
    "properties": {"resources": {"type": "array", "items": {"$ref": "#/definitions/resource"}}},
    "additionalProperties": False,
}

METADATA_PROPERTIES = list(METADATA_SCHEMA["properties"].keys())


def validate_metadata_schema(instance: Any):
    v = Draft7Validator(METADATA_SCHEMA)
    if not v.is_valid(instance):
        raise best_match(v.iter_errors(instance))
    return instance
