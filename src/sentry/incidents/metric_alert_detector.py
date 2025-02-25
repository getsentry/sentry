from datetime import timedelta
from typing import Any

from rest_framework import serializers

from sentry import audit_log
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.snuba_query_validator import SnubaQueryValidator
from sentry.snuba.subscriptions import update_snuba_query
from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.validators.base import (
    BaseDataConditionGroupValidator,
    BaseDetectorTypeValidator,
    NumericComparisonConditionValidator,
)
from sentry.workflow_engine.models import DataConditionGroup, DataSource, Detector
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.types import (
    DataConditionType,
    DetectorPriorityLevel,
    SnubaQueryDataSourceType,
)


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
    data_source = SnubaQueryValidator(required=True)
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

    def update_data_conditions(self, instance: Detector, data_conditions: list[DataConditionType]):
        """
        Update the data condition if it already exists, create one if it does not
        """
        if instance.workflow_condition_group:
            try:
                data_condition_group = DataConditionGroup.objects.get(
                    id=instance.workflow_condition_group.id
                )
            except DataConditionGroup.DoesNotExist:
                raise serializers.ValidationError("DataConditionGroup not found, can't update")
        # TODO make one if it doesn't exist and data is passed?

        for data_condition in data_conditions:
            if not data_condition.get("id"):
                current_data_condition = None
            else:
                try:
                    current_data_condition = DataCondition.objects.get(
                        id=str(data_condition.get("id")), condition_group=data_condition_group
                    )
                except DataCondition.DoesNotExist:
                    continue

            if current_data_condition:
                current_data_condition.update(**data_condition)
                current_data_condition.save()
            else:
                DataCondition.objects.create(
                    type=data_condition["type"],
                    comparison=data_condition["comparison"],
                    condition_result=data_condition["condition_result"],
                    condition_group=data_condition_group,
                )
        return data_condition_group

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
            time_window=timedelta(minutes=data_source.get("time_window", snuba_query.time_window)),
            resolution=timedelta(seconds=data_source.get("resolution", snuba_query.resolution)),
            environment=data_source.get("environment", snuba_query.environment),
            event_types=data_source.get("event_types", [event_type for event_type in event_types]),
        )

    def update(self, instance: Detector, validated_data: dict[str, Any]):
        instance.name = validated_data.get("name", instance.name)
        instance.type = validated_data.get("detector_type", instance.group_type).slug
        condition_group = validated_data.pop("condition_group")
        data_conditions: list[DataConditionType] = condition_group.get("conditions")

        if data_conditions:
            self.update_data_conditions(instance, data_conditions)

        data_source: SnubaQueryDataSourceType = validated_data.pop("data_source")
        if data_source:
            self.update_data_source(instance, data_source)

        instance.save()

        create_audit_entry(
            request=self.context["request"],
            organization=self.context["organization"],
            target_object=instance.id,
            event=audit_log.get_event_id("DETECTOR_EDIT"),
            data=instance.get_audit_log_data(),
        )
        return instance
