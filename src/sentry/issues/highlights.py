from collections.abc import Mapping
from typing import TypedDict

from jsonschema import Draft7Validator
from jsonschema.exceptions import ValidationError as SchemaValidationError
from rest_framework import serializers
from rest_framework.serializers import ValidationError

from sentry.models.project import Project
from sentry.utils.json import JSONData
from sentry.utils.platform_categories import BACKEND, FRONTEND, MOBILE

HIGHLIGHT_CONTEXT_SCHEMA: JSONData = {
    "type": "object",
    "patternProperties": {"^.*$": {"type": "array", "items": {"type": "string"}}},
    "additionalProperties": False,
}


class HighlightContextField(serializers.Field):
    def to_internal_value(self, data):
        if data is None:
            return

        if data == "" or data == {} or data == []:
            return {}

        v = Draft7Validator(HIGHLIGHT_CONTEXT_SCHEMA)
        try:
            v.validate(data)
        except SchemaValidationError as e:
            raise ValidationError(e.message)

        return data


class HighlightPreset(TypedDict):
    tags: list[str]
    context: Mapping[str, list[str]]


SENTRY_TAGS = ["handled", "level", "release", "environment"]

BACKEND_HIGHLIGHTS: HighlightPreset = {
    "tags": SENTRY_TAGS + ["url", "transaction", "status_code"],
    "context": {"trace": ["trace_id"], "runtime": ["name", "version"]},
}
FRONTEND_HIGHLIGHTS: HighlightPreset = {
    "tags": SENTRY_TAGS + ["url", "transaction", "browser", "replayId", "user"],
    "context": {"browser": ["name"], "user": ["email"]},
}
MOBILE_HIGHLIGHTS: HighlightPreset = {
    "tags": SENTRY_TAGS + ["mobile", "main_thread"],
    "context": {"profile": ["profile_id"], "app": ["name"], "device": ["family"]},
}

FALLBACK_HIGHLIGHTS: HighlightPreset = {
    "tags": SENTRY_TAGS,
    "context": {"user": ["email"], "trace": ["trace_id"]},
}


def get_highlight_preset_for_project(project: Project) -> HighlightPreset:
    if not project.platform or project.platform == "other":
        return FALLBACK_HIGLIGHTS
    elif project.platform in FRONTEND:
        return FRONTEND_HIGHLIGHTS
    elif project.platform in BACKEND:
        return BACKEND_HIGHLIGHTS
    elif project.platform in MOBILE:
        return MOBILE_HIGHLIGHTS
    return FALLBACK_HIGLIGHTS
