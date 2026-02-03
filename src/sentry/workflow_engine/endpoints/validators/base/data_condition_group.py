from typing import Any

from django.db import router, transaction
from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.workflow_engine.endpoints.validators.base import BaseDataConditionValidator
from sentry.workflow_engine.endpoints.validators.utils import remove_items_by_api_input
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.data_condition import TRIGGER_CONDITIONS, DataCondition


class BaseDataConditionGroupValidator(CamelSnakeSerializer[Any]):
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

    def _validate_logic_type(self, condition_data: list[dict[str, Any]], logic_type: str) -> None:
        """
        Validate that if we're passed a "trigger" it has the logic type 'any-short'
        """
        for condition in condition_data:
            if (condition.get("type") in TRIGGER_CONDITIONS) and (
                logic_type != DataConditionGroup.Type.ANY_SHORT_CIRCUIT.value
            ):
                raise serializers.ValidationError("Triggers' logic type must be 'any-short'")

    def update_or_create_condition(
        self, condition_data: dict[str, Any], organization_id: int
    ) -> DataCondition:
        validator = BaseDataConditionValidator()
        condition_id = condition_data.get("id")

        if condition_id:
            try:
                # Validate that the condition belongs to this organization
                condition = DataCondition.objects.get(
                    id=condition_id,
                    condition_group__organization_id=organization_id,
                )
            except DataCondition.DoesNotExist as exc:
                raise serializers.ValidationError(
                    f"Condition with id {condition_id} not found."
                ) from exc

            condition = validator.update(condition, condition_data)
        else:
            condition = validator.create(condition_data)

        return condition

    def update(
        self,
        instance: DataConditionGroup,
        validated_data: dict[str, Any],
    ) -> DataConditionGroup:
        # Require organization context to validate ownership of conditions
        context_org = self.context.get("organization") if self.context else None
        if not context_org:
            raise serializers.ValidationError("Organization context is required.")
        if instance.organization_id != context_org.id:
            raise serializers.ValidationError(f"Condition group with id {instance.id} not found.")

        logic_type = validated_data.get("logic_type")
        if not logic_type:
            logic_type = instance.logic_type

        condition_data = validated_data.get("conditions", [])
        if not condition_data:
            conditions = DataCondition.objects.filter(
                condition_group=instance,
            )
            for condition in conditions:
                condition_data.append(
                    {
                        "type": condition.type,
                        # don't actually need the last 2, just making it look legitimate
                        "comparison": condition.comparison,
                        "conditionResult": condition.condition_result,
                    }
                )

        self._validate_logic_type(condition_data, logic_type)

        remove_items_by_api_input(validated_data.get("conditions", []), instance.conditions, "id")
        conditions = validated_data.pop("conditions", None)
        if conditions:
            for condition_data in conditions:
                if not condition_data.get("condition_group_id"):
                    condition_data["condition_group_id"] = instance.id
                self.update_or_create_condition(condition_data, context_org.id)

        # update the condition group
        instance.update(**validated_data)
        return instance

    def create(self, validated_data: dict[str, Any]) -> DataConditionGroup:
        logic_type = validated_data.get("logic_type")
        if not logic_type:
            logic_type = DataConditionGroup.Type.ANY.value
        self._validate_logic_type(validated_data.get("conditions", []), logic_type)

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
