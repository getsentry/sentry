from rest_framework import serializers

from sentry.snuba.snuba_query_validator import SnubaQueryValidator
from sentry.workflow_engine.endpoints.validators.base import (
    BaseDataConditionGroupValidator,
    BaseDetectorTypeValidator,
    NumericComparisonConditionValidator,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class MetricAlertComparisonConditionValidator(NumericComparisonConditionValidator):
    supported_conditions = frozenset((Condition.GREATER, Condition.LESS))
    supported_condition_results = frozenset(
        (DetectorPriorityLevel.HIGH, DetectorPriorityLevel.MEDIUM)
    )
    condition_group_id = serializers.IntegerField(required=True)
    id = serializers.IntegerField(required=False)


class MetricAlertConditionGroupValidator(BaseDataConditionGroupValidator):
    conditions = MetricAlertComparisonConditionValidator(many=True)


class MetricAlertsDetectorValidator(BaseDetectorTypeValidator):
    data_sources = SnubaQueryValidator(required=True, many=True)
    condition_group = MetricAlertConditionGroupValidator(required=True)

    def validate(self, attrs):
        """
        This is just a sample implementation. We should have all the same logic here that
        we have for conditions, query validation, etc in
        https://github.com/getsentry/sentry/blob/837d5c1e13a8dc71b622aafec5191d84d0e827c7/src/sentry/incidents/serializers/alert_rule.py#L65
        """
        attrs = super().validate(attrs)
        conditions = attrs.get("condition_group", {}).get("conditions")
        if len(conditions) > 2:
            raise serializers.ValidationError("Too many conditions")
        return attrs
