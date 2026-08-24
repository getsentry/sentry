from __future__ import annotations

from rest_framework import serializers

from sentry.investigations.endpoints.validators.base import StrictCamelSnakeValidator

MAX_BREACHED_METRIC_GROUPS = 100


class BreachedMetricStatusValidator(StrictCamelSnakeValidator):
    group_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=1,
        max_length=MAX_BREACHED_METRIC_GROUPS,
    )

    def validate_group_ids(self, value: list[int]) -> list[int]:
        return list(dict.fromkeys(value))


class BreachedMetricLaunchValidator(StrictCamelSnakeValidator):
    group_id = serializers.IntegerField(min_value=1)
    open_period_id = serializers.IntegerField(min_value=1)
