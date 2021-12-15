import logging

from jsonschema import Draft7Validator
from jsonschema.exceptions import best_match

from sentry.utils.json import JSONData

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

METADATA_PROPERTIES = list(METADATA_SCHEMA["properties"].keys())


def validate_metadata_schema(instance: JSONData):
    v = Draft7Validator(METADATA_SCHEMA)
    if not v.is_valid(instance):
        raise best_match(v.iter_errors(instance))
    return instance
