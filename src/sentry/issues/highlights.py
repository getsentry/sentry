import re
from collections.abc import Mapping
from typing import TypedDict

from rest_framework import serializers

from sentry.models.project import Project
from sentry.utils.platform_categories import BACKEND, FRONTEND, MOBILE


class HighlightContextField(serializers.Field):
    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError("Expected a dictionary.")

        for key, value in data.items():
            if not re.match(r"^.+$", key):
                raise serializers.ValidationError(f"Key '{key}' is invalid.")
            if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
                raise serializers.ValidationError(f"Value for '{key}' must be a list of strings.")
            # Remove duplicates
            data[key] = list(set(value))

        return data

    def to_representation(self, value):
        return value


class HighlightPreset(TypedDict):
    tags: list[str]
    context: Mapping[str, list[str]]


SENTRY_TAGS = ["handled", "level", "release", "environment"]

BACKEND_HIGHLIGHTS: HighlightPreset = {
    "tags": SENTRY_TAGS + ["url", "transaction", "status_code"],
    "context": {"trace": ["trace_id"], "runtime": ["name", "version"]},
}
FRONTEND_HIGHLIGHTS: HighlightPreset = {
    "tags": SENTRY_TAGS + ["url", "transaction", "browser", "user"],
    "context": {"user": ["email"]},
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
        return FALLBACK_HIGHLIGHTS
    elif project.platform in FRONTEND:
        return FRONTEND_HIGHLIGHTS
    elif project.platform in BACKEND:
        return BACKEND_HIGHLIGHTS
    elif project.platform in MOBILE:
        return MOBILE_HIGHLIGHTS
    return FALLBACK_HIGHLIGHTS
