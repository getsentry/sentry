from rest_framework import serializers

from sentry.workflow_engine.endpoints.validators import (
    BaseDataSourceValidator,
    BaseGroupTypeDetectorValidator,
    NumericComparisonConditionValidator,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class MetricAlertComparisonConditionValidator(NumericComparisonConditionValidator):
    """
    Implementation note:
    This is just a reference for how to use these validators and a basic implementation for the
    metric alert conditions. Note that these shouldn't exist in this file long term - these are
    implementations, and so should be implemented in `incidents` project (or wherever we decide
    metric alerts live in the future).
    Only generic workflow code should live here
    """

    supported_conditions = frozenset((Condition.GREATER, Condition.LESS))
    supported_results = frozenset((DetectorPriorityLevel.HIGH, DetectorPriorityLevel.MEDIUM))
    type = "metric_alert"


class MetricAlertsDetectorValidator(BaseGroupTypeDetectorValidator):
    data_source = BaseDataSourceValidator()
    data_conditions = MetricAlertComparisonConditionValidator(many=True)

    def validate(self, attrs):
        """
        This is just a sample implementation. We should have all the same logic here that
        we have for conditions, query validation, etc in
        https://github.com/getsentry/sentry/blob/837d5c1e13a8dc71b622aafec5191d84d0e827c7/src/sentry/incidents/serializers/alert_rule.py#L65
        And this should be moved to a metric alert specific app, probably `incidents/`
        """
        attrs = super().validate(attrs)
        conditions = attrs["data_conditions"]
        if len(conditions) > 2:
            raise serializers.ValidationError("Too many conditions")
        return attrs
