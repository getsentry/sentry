from datetime import timedelta
from typing import Any

from rest_framework import serializers

from sentry import features, quotas
from sentry.constants import ObjectStatus
from sentry.incidents.logic import enable_disable_subscriptions
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.relay.config.metric_extraction import on_demand_metrics_feature_flags
from sentry.search.eap.trace_metrics.validator import validate_trace_metrics_aggregate
from sentry.seer.anomaly_detection.delete_rule import delete_data_in_seer_for_detector
from sentry.seer.anomaly_detection.store_data_workflow_engine import (
    send_new_detector_data,
    update_detector_data,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.extraction import should_use_on_demand_metrics
from sentry.snuba.models import (
    ExtrapolationMode,
    QuerySubscription,
    SnubaQuery,
    SnubaQueryEventType,
)
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
    prefilling_for_deprecation = (
        "organizations:on-demand-gen-metrics-deprecation-prefill" in enabled_features
    )
    if (
        "organizations:on-demand-metrics-extraction" not in enabled_features
        and not prefilling
        and not prefilling_for_deprecation
    ):
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
        prefilling_for_deprecation=prefilling_for_deprecation,
    )
    if should_use_on_demand:
        schedule_invalidate_project_config(
            trigger="alerts:create-on-demand-metric", project_id=detector.project.id
        )


class MetricIssueComparisonConditionValidator(BaseDataConditionValidator):
    supported_conditions = frozenset(
        (
            Condition.GREATER,
            Condition.LESS,
            Condition.GREATER_OR_EQUAL,
            Condition.LESS_OR_EQUAL,
            Condition.ANOMALY_DETECTION,
        )
    )
    supported_condition_results = frozenset(
        (DetectorPriorityLevel.HIGH, DetectorPriorityLevel.MEDIUM, DetectorPriorityLevel.OK)
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
        if not any(
            condition["condition_result"] == DetectorPriorityLevel.OK for condition in value
        ) and not any(condition["type"] == Condition.ANOMALY_DETECTION for condition in value):
            raise serializers.ValidationError(
                "Resolution condition required for metric issue detector."
            )
        return value


def is_invalid_extrapolation_mode(old_extrapolation_mode, new_extrapolation_mode) -> bool:
    if type(new_extrapolation_mode) is int:
        new_extrapolation_mode = ExtrapolationMode(new_extrapolation_mode).name.lower()
    if type(new_extrapolation_mode) is ExtrapolationMode:
        new_extrapolation_mode = new_extrapolation_mode.name.lower()
    if type(old_extrapolation_mode) is int:
        old_extrapolation_mode = ExtrapolationMode(old_extrapolation_mode).name.lower()
    if type(old_extrapolation_mode) is ExtrapolationMode:
        old_extrapolation_mode = old_extrapolation_mode.name.lower()
    if (
        new_extrapolation_mode is not None
        and ExtrapolationMode.from_str(new_extrapolation_mode) is None
    ):
        return True
    if (
        new_extrapolation_mode == ExtrapolationMode.SERVER_WEIGHTED.name.lower()
        and old_extrapolation_mode != ExtrapolationMode.SERVER_WEIGHTED.name.lower()
    ):
        return True
    return False


def format_extrapolation_mode(extrapolation_mode) -> ExtrapolationMode | None:
    if extrapolation_mode is None:
        return None
    if type(extrapolation_mode) is int:
        return ExtrapolationMode(extrapolation_mode)
    if type(extrapolation_mode) is ExtrapolationMode:
        return extrapolation_mode
    return ExtrapolationMode.from_str(extrapolation_mode)


class MetricIssueDetectorValidator(BaseDetectorTypeValidator):
    data_sources = serializers.ListField(
        child=SnubaQueryValidator(timeWindowSeconds=True), required=False
    )
    condition_group = MetricIssueConditionGroupValidator(required=True)

    def validate_eap_rule(self, attrs):
        """
        Validate EAP rule data.
        """
        data_sources = attrs.get("data_sources", [])
        for data_source in data_sources:
            event_types = data_source.get("event_types", [])
            if (
                data_source.get("dataset") == Dataset.EventsAnalyticsPlatform
                and SnubaQueryEventType.EventType.TRACE_ITEM_METRIC in event_types
            ):
                aggregate = data_source.get("aggregate")
                validate_trace_metrics_aggregate(aggregate)

    def validate(self, attrs):
        attrs = super().validate(attrs)

        if "condition_group" in attrs:
            conditions = attrs.get("condition_group", {}).get("conditions")
            if len(conditions) > 3:
                raise serializers.ValidationError("Too many conditions")

        if "data_sources" in attrs:
            self.validate_eap_rule(attrs)

        return attrs

    def _validate_transaction_dataset_deprecation(self, dataset: Dataset) -> None:
        organization = self.context.get("organization")
        if organization is None:
            raise serializers.ValidationError("Missing organization context")

        if features.has("organizations:discover-saved-queries-deprecation", organization):
            if dataset in [Dataset.PerformanceMetrics, Dataset.Transactions]:
                raise serializers.ValidationError(
                    "Creation of transaction-based alerts is disabled, as we migrate to the span dataset. Create span-based alerts (dataset: events_analytics_platform) with the is_transaction:true filter instead."
                )

    def _validate_extrapolation_mode(self, extrapolation_mode: ExtrapolationMode) -> None:
        if extrapolation_mode == ExtrapolationMode.SERVER_WEIGHTED:
            raise serializers.ValidationError(
                "server_weighted extrapolation mode is not supported for new detectors."
            )

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

    def is_editing_transaction_dataset(
        self, snuba_query: SnubaQuery, data_source: SnubaQueryDataSourceType
    ) -> bool:
        if data_source.get("dataset") in [Dataset.PerformanceMetrics, Dataset.Transactions] and (
            data_source.get("dataset", Dataset(snuba_query.dataset)) != Dataset(snuba_query.dataset)
            or data_source.get("query", snuba_query.query) != snuba_query.query
            or data_source.get("aggregate", snuba_query.aggregate) != snuba_query.aggregate
            or data_source.get("time_window", snuba_query.time_window) != snuba_query.time_window
            or data_source.get("event_types", snuba_query.event_types) != snuba_query.event_types
        ):
            return True
        return False

    def update_data_source(
        self, instance: Detector, data_source: SnubaQueryDataSourceType, seer_updated: bool = False
    ):
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

        if self.is_editing_transaction_dataset(snuba_query, data_source):
            raise serializers.ValidationError(
                "Updates to transaction-based alerts is disabled, as we migrate to the span dataset. Create span-based alerts (dataset: events_analytics_platform) with the is_transaction:true filter instead."
            )

        old_extrapolation_mode = snuba_query.extrapolation_mode
        new_extrapolation_mode = data_source.get(
            "extrapolation_mode", snuba_query.extrapolation_mode
        )
        if data_source.get("dataset") == Dataset.EventsAnalyticsPlatform:
            if is_invalid_extrapolation_mode(old_extrapolation_mode, new_extrapolation_mode):
                raise serializers.ValidationError(
                    "Invalid extrapolation mode for this detector type."
                )

        # Handle a dynamic detector's snuba query changing
        if instance.config.get("detection_type") == AlertRuleDetectionType.DYNAMIC:
            try:
                validated_data_source: dict[str, Any] = {"data_sources": [data_source]}
                if not seer_updated:
                    update_detector_data(instance, validated_data_source)
            except Exception:
                # don't update the snuba query if we failed to send data to Seer
                raise serializers.ValidationError(
                    "Failed to send data to Seer, cannot update detector"
                )

        extrapolation_mode = format_extrapolation_mode(
            data_source.get("extrapolation_mode", snuba_query.extrapolation_mode)
        )

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
            extrapolation_mode=extrapolation_mode,
        )

        # Mark that this detector's query was updated by a user
        self._mark_query_as_user_updated(snuba_query)

    def update_anomaly_detection(self, instance: Detector, validated_data: dict[str, Any]) -> bool:
        """
        When data changes on a detector we may need to tell Seer to update or remove their data for the detector
        """
        seer_updated = False
        is_currently_dynamic_detector = (
            instance.config.get("detection_type") == AlertRuleDetectionType.DYNAMIC
        )
        is_update_dynamic_detector = (
            validated_data.get("config", {}).get("detection_type") == AlertRuleDetectionType.DYNAMIC
        )
        if not is_currently_dynamic_detector and is_update_dynamic_detector:
            # Detector has been changed to become a dynamic detector
            try:
                update_detector_data(instance, validated_data)
                seer_updated = True
            except Exception:
                # Don't update if we failed to send data to Seer
                raise serializers.ValidationError(
                    "Failed to send data to Seer, cannot update detector"
                )

        elif (
            validated_data.get("config")
            and is_currently_dynamic_detector
            and not is_update_dynamic_detector
        ):
            # Detector has been changed from a dynamic detector to another type
            delete_data_in_seer_for_detector(instance)

        return seer_updated

    def update(self, instance: Detector, validated_data: dict[str, Any]):
        # Handle anomaly detection changes first in case we need to exit before saving so that the instance values do not get updated
        seer_updated = self.update_anomaly_detection(instance, validated_data)

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

        # Handle data sources
        data_source: SnubaQueryDataSourceType | None = None

        if "data_sources" in validated_data:
            data_source = validated_data.pop("data_sources")[0]

        if data_source is not None:
            self.update_data_source(instance, data_source, seer_updated)

        instance.save()

        schedule_update_project_config(instance)
        return instance

    def create(self, validated_data: dict[str, Any]):
        if "data_sources" in validated_data:
            for validated_data_source in validated_data["data_sources"]:
                self._validate_transaction_dataset_deprecation(validated_data_source.get("dataset"))
                self._validate_extrapolation_mode(validated_data_source.get("extrapolation_mode"))

        detector = super().create(validated_data)

        if detector.config.get("detection_type") == AlertRuleDetectionType.DYNAMIC.value:
            try:
                send_new_detector_data(detector)
            except Exception:
                # Sending historical data failed; Detector won't be saved, but we
                # need to clean up database state that has already been created.
                detector.workflow_condition_group.delete()
                raise

        schedule_update_project_config(detector)
        return detector

    def delete(self):
        # Let Seer know we're deleting a dynamic detector so the data can be deleted there too
        assert self.instance is not None
        detector: Detector = self.instance
        delete_data_in_seer_for_detector(detector)

        super().delete()

    def _mark_query_as_user_updated(self, snuba_query: SnubaQuery):
        """
        Mark the snuba query as user-updated in the query_snapshot field.
        This is used to skip automatic migrations for queries that users have already modified.
        Only marks queries that already have a snapshot (i.e., were previously migrated).
        """
        snuba_query.refresh_from_db()
        if snuba_query.query_snapshot is None:
            return
        snuba_query.query_snapshot["user_updated"] = True
        snuba_query.save()
