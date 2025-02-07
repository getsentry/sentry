from rest_framework import serializers

from sentry.snuba.snuba_query_validator import SnubaQueryValidator
from sentry.workflow_engine.endpoints.validators.base import (
    BaseGroupTypeDetectorValidator,
    NumericComparisonConditionValidator,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class MetricAlertComparisonConditionValidator(NumericComparisonConditionValidator):
    supported_conditions = frozenset((Condition.GREATER, Condition.LESS))
    supported_results = frozenset((DetectorPriorityLevel.HIGH, DetectorPriorityLevel.MEDIUM))


class MetricAlertsDetectorValidator(BaseGroupTypeDetectorValidator):
    data_source = SnubaQueryValidator(required=True)
    data_conditions = MetricAlertComparisonConditionValidator(many=True)

    def validate(self, attrs):
        """
        This is just a sample implementation. We should have all the same logic here that
        we have for conditions, query validation, etc in
        https://github.com/getsentry/sentry/blob/837d5c1e13a8dc71b622aafec5191d84d0e827c7/src/sentry/incidents/serializers/alert_rule.py#L65
        """
        attrs = super().validate(attrs)
        conditions = attrs["data_conditions"]
        if len(conditions) > 2:
            raise serializers.ValidationError("Too many conditions")
        return attrs
