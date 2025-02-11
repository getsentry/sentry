from datetime import timedelta

from rest_framework import serializers

from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.snuba_query_validator import SnubaQueryValidator
from sentry.snuba.subscriptions import update_snuba_query
from sentry.workflow_engine.endpoints.validators.base import (
    BaseDataConditionGroupValidator,
    BaseDetectorTypeValidator,
    BaseDataConditionGroupValidator,
    NumericComparisonConditionValidator,
)
from sentry.workflow_engine.models import DataCondition, DataConditionGroup, DataSource
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

    def update_data_conditions(self, instance, data_conditions):
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
        # else make one if data is passed?

        for data_condition in data_conditions:
            current_data_condition = DataCondition.objects.get(
                id=data_condition.get("id"), condition_group=data_condition_group
            )
            # XXX: we pass 'result' rather than 'condition_result' - enforced by the NumericComparisonConditionValidator
            updated_values = {
                "type": data_condition.get("type", current_data_condition.type),
                "comparison": data_condition.get("comparison", current_data_condition.comparison),
                "condition_result": data_condition.get(
                    "result", current_data_condition.condition_result
                ),
            }
            if current_data_condition:
                data_condition.update(**updated_values)
            return instance.workflow_condition_group

            DataCondition.objects.create(
                type=data_conditions.get("type"),
                comparison=data_conditions.get("comparison"),
                condition_result=data_conditions.get("result"),
                workflow_condition_group=data_condition_group,
            )
        return data_condition_group

    def update_data_sources(self, instance, data_sources):
        for source in data_sources:
            try:
                source_instance = DataSource.objects.get(detector=instance)
            except DataSource.DoesNotExist:
                continue
            if source_instance:
                try:
                    snuba_query = SnubaQuery.objects.get(id=source_instance.source_id)
                except SnubaQuery.DoesNotExist:
                    raise serializers.ValidationError("SnubaQuery not found, can't update")

            event_types = SnubaQueryEventType.objects.filter(snuba_query_id=snuba_query.id)
            update_snuba_query(
                snuba_query=snuba_query,
                query_type=source.get("query_type", snuba_query.type),
                dataset=source.get("dataset", snuba_query.dataset),
                query=source.get("query", snuba_query.query),
                aggregate=source.get("aggregate", snuba_query.aggregate),
                time_window=timedelta(minutes=source.get("time_window", snuba_query.time_window)),
                resolution=timedelta(seconds=source.get("resolution", snuba_query.resolution)),
                environment=source.get("environment", snuba_query.environment),
                event_types=source.get("event_types", [event_types]),
            )

    def update(self, instance, validated_data):
        instance.name = validated_data.get("name", instance.name)
        instance.type = validated_data.get("detector_type", instance.group_type.slug)
        condition_group = validated_data.pop("condition_group")
        data_conditions = condition_group.get("data_conditions")
        if data_conditions:
            instance.workflow_condition_group = self.update_data_conditions(
                instance, data_conditions
            )
        data_sources = validated_data.pop("data_sources")
        if data_sources:
            self.update_data_sources(instance, data_sources)

        instance.save()
        return instance
