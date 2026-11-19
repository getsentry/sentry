"""
API response schemas for Sentry App UI components, built from the UI component JSON
Schema that `sentry.sentry_apps.api.parsers.schema` validates app schemas with. Sentry
adds a few properties when it prepares a component for the UI, which are added here.
"""

from __future__ import annotations

import copy
from typing import Any, cast

from sentry.apidocs.json_schemas import to_response_schema
from sentry.sentry_apps.api.parsers.schema import ELEMENT_TYPES, SCHEMA

_DESCRIPTIONS = {
    "type": "Type of the element",
    "label": "Label of the form field",
    "name": "Name of the form field, which keys its value in the submitted form",
    "async": "Whether the field loads its options from uri as the user types",
    "skip_load_on_open": "Whether to skip loading the options from uri when the form opens",
    "multiple": "Whether more than one option can be selected",
    "uri": "Path on the integration's server that Sentry sends requests to",
    "options": "Options to choose from, each a two-item array",
    "depends_on": "Names of the fields that this field's options depend on",
    "default": "Issue field that prefills the field",
    "choices": "Options to choose from, loaded from options or from uri. Each is a two-item array",
    "defaultValue": "Value selected by default, from the options loaded from uri",
    "header.text": "Text of the header",
    "markdown.text": "Markdown text",
    "image.url": "URL of the image",
    "image.alt": "Alternative text of the image",
    "video.url": "URL of the video",
    "stacktrace-link.url": "URL of the link, built from uri with the installation and project",
    "issue-link.link": "Form for linking an existing issue",
    "issue-link.create": "Form for creating an issue",
    "required_fields": "Fields that the user must fill in",
    "optional_fields": "Fields that the user can fill in",
    "alert-rule-settings.description": "Text shown above the settings form",
    "title": "Title of the element",
    "alert-rule-action.settings": "Settings form of the alert rule action",
    "issue-media.elements": "Media elements to show",
}

# What SentryAppComponentPreparer adds to a component before the UI gets it.
_PREPARED_PROPERTIES: dict[str, dict[str, Any]] = {
    "select": {
        "choices": {
            "type": "array",
            "items": {
                "type": "array",
                "minItems": 2,
                "maxItems": 2,
                "items": {"anyOf": [{"type": "string"}, {"type": "number"}]},
            },
        },
        "defaultValue": {"type": "string"},
    },
    "stacktrace-link": {"url": {"type": "string", "format": "uri"}},
}


def _allow_relative_uris(node: Any) -> None:
    # The source schema pairs format "uri" with a pattern that accepts paths such as
    # /sentry/issues. Its validator doesn't check formats, so the pattern is the rule, and
    # OpenAPI calls a value that can be a path a uri-reference.
    if isinstance(node, dict):
        if node.get("format") == "uri" and "pattern" in node:
            node["format"] = "uri-reference"
        for value in node.values():
            _allow_relative_uris(value)
    elif isinstance(node, list):
        for value in node:
            _allow_relative_uris(value)


def component_definitions() -> dict[str, Any]:
    definitions = copy.deepcopy(cast(dict[str, Any], SCHEMA["definitions"]))
    _allow_relative_uris(definitions)
    for name, properties in _PREPARED_PROPERTIES.items():
        definitions[name]["properties"].update(copy.deepcopy(properties))
    return definitions


def component_schema() -> dict[str, Any]:
    return to_response_schema(
        {"anyOf": [{"$ref": f"#/definitions/{element}"} for element in ELEMENT_TYPES]},
        definitions=component_definitions(),
        descriptions=_DESCRIPTIONS,
    )


def alert_rule_settings_schema() -> dict[str, Any]:
    return to_response_schema(
        {"$ref": "#/definitions/alert-rule-settings"},
        definitions=component_definitions(),
        descriptions=_DESCRIPTIONS,
    )
