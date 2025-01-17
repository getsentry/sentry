import re
from typing import TypedDict

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.models.project import Project
from sentry.utils.platform_categories import MOBILE


@extend_schema_field(field=OpenApiTypes.OBJECT)
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
    context: dict[str, list[str]]


DEFAULT_HIGHLIGHT_TAGS = ["handled", "level"]
DEFAULT_HIGHLIGHT_CTX = {"trace": ["trace_id"]}

MOBILE_HIGHLIGHTS: HighlightPreset = {
    "tags": DEFAULT_HIGHLIGHT_TAGS + ["mobile", "main_thread"],
    "context": {**DEFAULT_HIGHLIGHT_CTX, "profile": ["profile_id"], "app": ["name"]},
}
FALLBACK_HIGHLIGHTS: HighlightPreset = {
    "tags": DEFAULT_HIGHLIGHT_TAGS + ["url"],
    "context": {**DEFAULT_HIGHLIGHT_CTX},
}


def get_highlight_preset_for_project(project: Project) -> HighlightPreset:
    if not project.platform or project.platform == "other":
        return FALLBACK_HIGHLIGHTS
    elif project.platform in MOBILE:
        return MOBILE_HIGHLIGHTS
    return FALLBACK_HIGHLIGHTS
