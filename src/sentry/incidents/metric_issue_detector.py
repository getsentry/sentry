from datetime import timedelta
from typing import Any

from rest_framework import serializers

from sentry.incidents.logic import enable_disable_subscriptions
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.snuba_query_validator import SnubaQueryValidator
from sentry.snuba.subscriptions import update_snuba_query
from sentry.workflow_engine.endpoints.validators.base import (
    BaseDataConditionGroupValidator,
    BaseDetectorTypeValidator,
)
from sentry.workflow_engine.endpoints.validators.base.data_condition import (
    BaseDataConditionValidator,
)
from sentry.workflow_engine.models import DataSource, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel, SnubaQueryDataSourceType


class MetricIssueComparisonConditionValidator(BaseDataConditionValidator):
    supported_conditions = frozenset(
        (Condition.GREATER, Condition.LESS, Condition.ANOMALY_DETECTION)
    )
    supported_condition_results = frozenset(
        (DetectorPriorityLevel.HIGH, DetectorPriorityLevel.MEDIUM)
    )

    def validate_type(self, value: str) -> Condition:
        try:
            type = Condition(value)
        except ValueError:
            type = None

        if type not in self.supported_conditions:
            raise serializers.ValidationError(f"Unsupported type {value}")

        return type

    def validate_comparison(self, value: dict | float | int | str) -> float | dict:
        if isinstance(value, (float, int)):
            try:
                value = float(value)
            except ValueError:
                raise serializers.ValidationError("A valid number is required.")
            return value

        elif isinstance(value, dict):
            return super().validate_comparison(value)

        else:
            raise serializers.ValidationError("A valid number or dict is required.")

    def validate_condition_result(self, value: str) -> DetectorPriorityLevel:
        try:
            result = DetectorPriorityLevel(int(value))
        except ValueError:
            result = None

        if result not in self.supported_condition_results:
            raise serializers.ValidationError("Unsupported condition result")

        return result


class MetricIssueConditionGroupValidator(BaseDataConditionGroupValidator):
    conditions = serializers.ListField(required=True)

    def validate_conditions(self, value):
        MetricIssueComparisonConditionValidator(data=value, many=True).is_valid(
            raise_exception=True
        )
        return value


class MetricIssueDetectorValidator(BaseDetectorTypeValidator):
    data_source = SnubaQueryValidator(required=True, timeWindowSeconds=True)
    condition_group = MetricIssueConditionGroupValidator(required=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        conditions = attrs.get("condition_group", {}).get("conditions")
        if len(conditions) > 2:
            raise serializers.ValidationError("Too many conditions")
        return attrs

    def update_data_source(self, instance: Detector, data_source: SnubaQueryDataSourceType):
        try:
            source_instance = DataSource.objects.get(detector=instance)
        except DataSource.DoesNotExist:
            return
        if source_instance:
            try:
                query_subscription = QuerySubscription.objects.get(id=source_instance.source_id)
            except QuerySubscription.DoesNotExist:
                raise serializers.ValidationError("QuerySubscription not found, can't update")
        if query_subscription:
            try:
                snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query.id)
            except SnubaQuery.DoesNotExist:
                raise serializers.ValidationError("SnubaQuery not found, can't update")

        event_types = SnubaQueryEventType.objects.filter(snuba_query_id=snuba_query.id)
        update_snuba_query(
            snuba_query=snuba_query,
            query_type=data_source.get("query_type", snuba_query.type),
            dataset=data_source.get("dataset", snuba_query.dataset),
            query=data_source.get("query", snuba_query.query),
            aggregate=data_source.get("aggregate", snuba_query.aggregate),
            time_window=timedelta(seconds=data_source.get("time_window", snuba_query.time_window)),
            resolution=timedelta(seconds=data_source.get("resolution", snuba_query.resolution)),
            environment=data_source.get("environment", snuba_query.environment),
            event_types=data_source.get("event_types", [event_type for event_type in event_types]),
        )

    def update(self, instance: Detector, validated_data: dict[str, Any]):
        super().update(instance, validated_data)

        # Handle enable/disable query subscriptions
        if "enabled" in validated_data:
            enabled = validated_data.get("enabled")
            assert isinstance(enabled, bool)

            query_subscriptions = QuerySubscription.objects.filter(
                id__in=[data_source.source_id for data_source in instance.data_sources.all()]
            )
            if query_subscriptions:
                enable_disable_subscriptions(query_subscriptions, enabled)

        data_source: SnubaQueryDataSourceType = validated_data.pop("data_source")
        if data_source:
            self.update_data_source(instance, data_source)

        instance.save()
        return instance
