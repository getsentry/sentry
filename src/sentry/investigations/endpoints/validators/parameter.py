from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.investigations.endpoints.validators.base import StrictCamelSnakeValidator


class ParameterValuesValidator(StrictCamelSnakeValidator):
    investigation_version = serializers.IntegerField(
        min_value=1,
        help_text="Current investigation version from the latest detail response. Stale versions return 409.",
    )
    values = serializers.JSONField(
        help_text="Object mapping existing parameter keys to saved values. Values must satisfy each parameter definition; dependent blocks become stale."
    )

    def validate_values(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
        return value
