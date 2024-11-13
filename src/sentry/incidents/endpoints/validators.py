from collections.abc import Sequence
from datetime import timedelta

from rest_framework import serializers

from sentry.api.serializers.rest_framework import EnvironmentField
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.workflow_engine.endpoints.validators import (
    BaseDataSourceValidator,
    BaseGroupTypeDetectorValidator,
    NumericComparisonConditionValidator,
)
from sentry.workflow_engine.models import DataSource
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class SnubaQueryDataSourceValidator(BaseDataSourceValidator[QuerySubscription]):
    query_type = serializers.IntegerField(required=True)
    dataset = serializers.CharField(required=True)
    query = serializers.CharField(required=True)
    aggregate = serializers.CharField(required=True)
    time_window = serializers.IntegerField(required=True)
    environment = EnvironmentField(required=True, allow_null=True)
    event_types = serializers.ListField(
        child=serializers.IntegerField(),
    )

    data_source_type = DataSource.Type.SNUBA_QUERY_SUBSCRIPTION

    def validate_query_type(self, value: int) -> SnubaQuery.Type:
        try:
            return SnubaQuery.Type(value)
        except ValueError:
            raise serializers.ValidationError(f"Invalid query type {value}")

    def validate_dataset(self, value: str) -> Dataset:
        try:
            return Dataset(value)
        except ValueError:
            raise serializers.ValidationError(
                f"Invalid dataset {value}. Must be one of: {', '.join(Dataset.__members__)}"
            )

    def validate_event_types(self, value: Sequence[int]) -> list[SnubaQueryEventType.EventType]:
        try:
            return [SnubaQueryEventType.EventType(t) for t in value]
        except ValueError:
            raise serializers.ValidationError(f"Invalid event type: {value}")

    def validate_time_window(self, value: int) -> timedelta:
        return timedelta(minutes=value)

    def create_source(self, validated_data) -> QuerySubscription:
        snuba_query = create_snuba_query(
            query_type=validated_data["query_type"],
            dataset=validated_data["dataset"],
            query=validated_data["query"],
            aggregate=validated_data["aggregate"],
            time_window=validated_data["time_window"],
            # TODO: Feed the usual metric alerts logic in here based on time window
            resolution=timedelta(minutes=1),
            environment=validated_data["environment"],
            event_types=validated_data["event_types"],
        )
        return create_snuba_subscription(
            project=self.context["project"],
            subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            snuba_query=snuba_query,
        )


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
    data_source = SnubaQueryDataSourceValidator(required=True)
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
