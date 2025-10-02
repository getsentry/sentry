from datetime import timedelta
from typing import Any

from rest_framework import serializers

from sentry import features, quotas
from sentry.constants import ObjectStatus
from sentry.incidents.logic import enable_disable_subscriptions
from sentry.relay.config.metric_extraction import on_demand_metrics_feature_flags
from sentry.snuba.metrics.extraction import should_use_on_demand_metrics
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.snuba_query_validator import SnubaQueryValidator
from sentry.snuba.subscriptions import update_snuba_query
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.workflow_engine.endpoints.validators.base import (
    BaseDataConditionGroupValidator,
    BaseDetectorTypeValidator,
    DetectorQuota,
)
from sentry.workflow_engine.endpoints.validators.base.data_condition import (
    BaseDataConditionValidator,
)
from sentry.workflow_engine.models import DataSource, Detector
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel, SnubaQueryDataSourceType


def fetch_snuba_query(detector: Detector) -> SnubaQuery | None:
    try:
        source_instance = DataSource.objects.get(detector=detector)
    except DataSource.DoesNotExist:
        return None
    if source_instance:
        try:
            query_subscription = QuerySubscription.objects.get(id=source_instance.source_id)
        except QuerySubscription.DoesNotExist:
            return None
    if query_subscription:
        try:
            snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query.id)
        except SnubaQuery.DoesNotExist:
            return None
    return snuba_query


def schedule_update_project_config(detector: Detector) -> None:
    """
    If `should_use_on_demand`, then invalidate the project configs
    """
    enabled_features = on_demand_metrics_feature_flags(detector.project.organization)
    prefilling = "organizations:on-demand-metrics-prefill" in enabled_features
    if "organizations:on-demand-metrics-extraction" not in enabled_features and not prefilling:
        return

    snuba_query = fetch_snuba_query(detector)
    if not snuba_query:
        return

    should_use_on_demand = should_use_on_demand_metrics(
        snuba_query.dataset,
        snuba_query.aggregate,
        snuba_query.query,
        None,
        prefilling,
    )
    if should_use_on_demand:
        schedule_invalidate_project_config(
            trigger="alerts:create-on-demand-metric", project_id=detector.project.id
        )


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
    data_sources = serializers.ListField(
        child=SnubaQueryValidator(timeWindowSeconds=True), required=False
    )
    condition_group = MetricIssueConditionGroupValidator(required=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)

        if "condition_group" in attrs:
            conditions = attrs.get("condition_group", {}).get("conditions")
            if len(conditions) > 2:
                raise serializers.ValidationError("Too many conditions")

        return attrs

    def get_quota(self) -> DetectorQuota:
        organization = self.context.get("organization")
        request = self.context.get("request")
        if organization is None or request is None:
            raise serializers.ValidationError("Missing organization/request context")

        detector_limit = quotas.backend.get_metric_detector_limit(organization.id)
        if (
            not features.has(
                "organizations:workflow-engine-metric-detector-limit",
                organization,
                actor=request.user,
            )
            or detector_limit == -1
        ):
            return DetectorQuota(has_exceeded=False, limit=-1, count=-1)

        detector_count = Detector.objects.filter(
            project__organization=organization,
            type="metric_issue",  # Avoided circular import. TODO: move magic strings to constant file
            status=ObjectStatus.ACTIVE,
        ).count()
        has_exceeded = detector_count >= detector_limit

        return DetectorQuota(has_exceeded=has_exceeded, limit=detector_limit, count=detector_count)

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

        if "data_source" in validated_data:
            data_source: SnubaQueryDataSourceType = validated_data.pop("data_source")
            if data_source:
                self.update_data_source(instance, data_source)

        instance.save()

        schedule_update_project_config(instance)
        return instance

    def create(self, validated_data: dict[str, Any]):
        detector = super().create(validated_data)

        schedule_update_project_config(detector)
        return detector
