import logging
from typing import Mapping

from jsonschema import Draft7Validator
from jsonschema.exceptions import best_match

logger = logging.getLogger(__name__)

METADATA_SCHEMA = {
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

METADATA_TYPES = ["resources"]


def validate_metadata_schema(instance: Mapping[str, any]):
    v = Draft7Validator(METADATA_SCHEMA)
    if not v.is_valid(instance):
        raise best_match(v.iter_errors(instance))
