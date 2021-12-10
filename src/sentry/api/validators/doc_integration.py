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
        }
    },
    "properties": {"resources": {"type": "array", "items": {"$ref": "#/definitions/resource"}}},
}

METADATA_TYPES = ["resources"]


def validate_metadata_schema(instance: Mapping[str, any], schema: Mapping[str, any]):
    v = Draft7Validator(schema)
    if not v.is_valid(instance):
        raise best_match(v.iter_errors(instance))
