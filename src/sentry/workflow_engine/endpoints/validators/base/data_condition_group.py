from django.db import router, transaction
from rest_framework import serializers

# from sentry import audit_log
from sentry.api.serializers.rest_framework import CamelSnakeSerializer

# from sentry.utils.audit import create_audit_entry
from sentry.workflow_engine.endpoints.validators.base import BaseDataConditionValidator
from sentry.workflow_engine.models import DataCondition, DataConditionGroup


class BaseDataConditionGroupValidator(CamelSnakeSerializer):
    logic_type = serializers.CharField(required=True)
    organization_id = serializers.IntegerField(required=True)
    conditions = serializers.ListField(required=False)

    def validate_conditions(self, value) -> list:
        for condition in value:
            BaseDataConditionValidator(data=condition).is_valid(raise_exception=True)

        return value

    def update(self, instance, validated_data):
        raise NotImplementedError

    def create(self, validated_data) -> tuple[DataConditionGroup, list[DataCondition]]:
        with transaction.atomic(router.db_for_write(DataConditionGroup)):
            condition_group = DataConditionGroup.objects.create(
                logic_type=validated_data["logic_type"],
                organization_id=validated_data["organization_id"],
            )

            data_conditions: list[DataCondition] = []
            for condition in validated_data["conditions"]:
                data_condition = DataCondition.objects.create(
                    condition_group_id=condition_group.id,
                    **condition,
                )
                data_conditions.append(data_condition)

            # create_audit_entry(
            #     request=self.context["request"],
            #     organization=self.context["organization"],
            #     target_object=condition_group.id,
            #     event=audit_log.get_event_id("DATA_CONDITION_GROUP_ADD"),
            #     data=condition_group.get_audit_log_data(),
            # )

            return condition_group, data_conditions
