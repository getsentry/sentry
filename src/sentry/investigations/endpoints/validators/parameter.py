from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.investigations.endpoints.validators.base import StrictCamelSnakeValidator


class ParameterValuesValidator(StrictCamelSnakeValidator):
    investigation_version = serializers.IntegerField(min_value=1)
    values = serializers.JSONField()

    def validate_values(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Must be an object.")
        return value
