from typing import Any

from django.db import router, transaction
from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.workflow_engine.endpoints.validators.base import BaseDataConditionValidator
from sentry.workflow_engine.endpoints.validators.utils import remove_items_by_api_input
from sentry.workflow_engine.models import DataCondition, DataConditionGroup


class BaseDataConditionGroupValidator(CamelSnakeSerializer):
    id = serializers.CharField(required=False)
    logic_type = serializers.ChoiceField([(t.value, t.value) for t in DataConditionGroup.Type])
    conditions = serializers.ListField(required=False)

    def validate_conditions(self, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        conditions = []
        for condition in value:
            condition_validator = BaseDataConditionValidator(data=condition)
            condition_validator.is_valid(raise_exception=True)
            conditions.append(condition_validator.validated_data)

        return conditions

    def update_or_create_condition(self, condition_data: dict[str, Any]) -> DataCondition:
        validator = BaseDataConditionValidator()
        condition_id = condition_data.get("id")

        if condition_id:
            try:
                condition = DataCondition.objects.get(id=condition_id)
            except DataCondition.DoesNotExist:
                raise serializers.ValidationError(f"Condition with id {condition_id} not found.")

            condition = validator.update(condition, condition_data)
        else:
            condition = validator.create(condition_data)

        return condition

    def update(
        self,
        instance: DataConditionGroup,
        validated_data: dict[str, Any],
    ) -> DataConditionGroup:
        remove_items_by_api_input(validated_data.get("conditions", []), instance.conditions, "id")

        conditions = validated_data.pop("conditions", None)
        if conditions:
            for condition_data in conditions:
                if not condition_data.get("condition_group_id"):
                    condition_data["condition_group_id"] = instance.id

                self.update_or_create_condition(condition_data)

        # update the condition group
        instance.update(**validated_data)
        return instance

    def create(self, validated_data: dict[str, Any]) -> DataConditionGroup:
        with transaction.atomic(router.db_for_write(DataConditionGroup)):
            condition_group = DataConditionGroup.objects.create(
                logic_type=validated_data["logic_type"],
                organization_id=self.context["organization"].id,
            )

            for condition in validated_data["conditions"]:
                if not condition.get("condition_group_id"):
                    condition["condition_group_id"] = condition_group.id
                condition_validator = BaseDataConditionValidator()
                condition_validator.create(condition)

            return condition_group
