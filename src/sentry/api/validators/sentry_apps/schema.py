from __future__ import absolute_import

from jsonschema import Draft4Validator
from jsonschema.exceptions import best_match
from jsonschema.exceptions import ValidationError as SchemaValidationError

SCHEMA = {
    "type": "object",
    "definitions": {
        # Property Types
        "uri": {"type": "string", "format": "uri", "pattern": r"^\/"},
        "options": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "array",
                "minItems": 2,
                "maxItems": 2,
                "items": [{"type": "string"}, {"anyOf": [{"type": "string"}, {"type": "number"}]}],
            },
        },
        "fieldset": {
            "type": "array",
            "minItems": 1,
            "items": {
                "anyOf": [
                    {"$ref": "#/definitions/select"},
                    {"$ref": "#/definitions/text"},
                    {"$ref": "#/definitions/textarea"},
                ]
            },
        },
        # Form Components
        "select": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["select"]},
                "label": {"type": "string"},
                "name": {"type": "string"},
                "uri": {"$ref": "#/definitions/uri"},
                "options": {"$ref": "#/definitions/options"},
            },
            "required": ["type", "name", "label"],
            "oneOf": [{"required": ["uri"]}, {"required": ["options"]}],
        },
        "text": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["text"]},
                "label": {"type": "string"},
                "name": {"type": "string"},
                "default": {"type": "string", "enum": ["issue.title", "issue.description"]},
            },
            "required": ["type", "label", "name"],
        },
        "textarea": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["textarea"]},
                "label": {"type": "string"},
                "name": {"type": "string"},
                "default": {"type": "string", "enum": ["issue.title", "issue.description"]},
            },
            "required": ["type", "label", "name"],
        },
        # Composable Components
        "header": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["header"]},
                "text": {"type": "string"},
            },
            "required": ["type", "text"],
        },
        "image": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["image"]},
                "url": {"type": "string", "format": "uri", "pattern": r"^(?:https?|\/)"},
                "alt": {"type": "string"},
            },
            "required": ["type", "url"],
        },
        "video": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["video"]},
                "url": {"type": "string", "format": "uri", "pattern": r"^(?:https?|\/)"},
            },
            "required": ["type", "url"],
        },
        "markdown": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["markdown"]},
                "text": {"type": "string"},
            },
            "required": ["type", "text"],
        },
        # Feature Components
        "issue-link": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["issue-link"]},
                "link": {
                    "type": "object",
                    "properties": {
                        "uri": {"$ref": "#/definitions/uri"},
                        "required_fields": {"$ref": "#/definitions/fieldset"},
                        "optional_fields": {"$ref": "#/definitions/fieldset"},
                    },
                    "required": ["uri", "required_fields"],
                },
                "create": {
                    "type": "object",
                    "properties": {
                        "uri": {"$ref": "#/definitions/uri"},
                        "required_fields": {"$ref": "#/definitions/fieldset"},
                        "optional_fields": {"$ref": "#/definitions/fieldset"},
                    },
                    "required": ["uri", "required_fields"],
                },
            },
            "required": ["type", "link", "create"],
        },
        "alert-rule-action": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["alert-rule-action"]},
                "required_fields": {"$ref": "#/definitions/fieldset"},
                "optional_fields": {"$ref": "#/definitions/fieldset"},
            },
            "required": ["type", "required_fields"],
        },
        "issue-media": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["issue-media"]},
                "title": {"type": "string"},
                "elements": {
                    "type": "array",
                    "minItems": 1,
                    "items": {
                        "anyOf": [
                            {"$ref": "#/definitions/header"},
                            {"$ref": "#/definitions/markdown"},
                            {"$ref": "#/definitions/image"},
                            {"$ref": "#/definitions/video"},
                        ]
                    },
                },
            },
            "required": ["type", "title", "elements"],
        },
        "stacktrace-link": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["stacktrace-link"]},
                "uri": {"$ref": "#/definitions/uri"},
            },
            "required": ["type", "uri"],
        },
    },
    "properties": {
        "elements": {
            "type": "array",
            "minItems": 1,
            "items": {
                "anyOf": [
                    {"$ref": "#/definitions/issue-link"},
                    {"$ref": "#/definitions/alert-rule-action"},
                    {"$ref": "#/definitions/issue-media"},
                    {"$ref": "#/definitions/stacktrace-link"},
                ]
            },
        }
    },
    "required": ["elements"],
}

element_types = ['issue-link', 'alert-rule-action', 'issue-media', 'stacktrace-link']


def checkElementsIsArray(instance):
    if not isinstance(instance['elements'], list):
        raise SchemaValidationError("'elements' should be an array of objects")


def checkForElementTypeError(instance):
    for element in instance['elements']:
        if 'type' not in element:
            raise SchemaValidationError("Each element needs a 'type' field")
        found_type = element['type']
        if not found_type in element_types:
            raise SchemaValidationError("Element has type '%s'. Type must be one of the following: %s" % (found_type, element_types))


def validate(instance):
    try:
        # schema validator will catch elements missing
        checkElementsIsArray(instance)
        checkForElementTypeError(instance)
    except SchemaValidationError as e:
        raise e
    except Exception as e:
        # pre-validators might have unexpected errors if the format is not what they expect in the check
        # if that happens, we should eat the error and let the main validator find the schema error
        pass
    v = Draft4Validator(SCHEMA)
    if not v.is_valid(instance):
        raise best_match(v.iter_errors(instance))
