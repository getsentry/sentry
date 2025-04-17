from typing import Any

from django.db import router, transaction
from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.workflow_engine.endpoints.validators.base import BaseDataConditionValidator
from sentry.workflow_engine.models import DataConditionGroup


class BaseDataConditionGroupValidator(CamelSnakeSerializer):
    logic_type = serializers.ChoiceField([(t.value, t.value) for t in DataConditionGroup.Type])
    conditions = serializers.ListField(required=False)

    def validate_conditions(self, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        conditions = []
        for condition in value:
            condition_validator = BaseDataConditionValidator(data=condition)
            condition_validator.is_valid(raise_exception=True)
            conditions.append(condition_validator.validated_data)

        return conditions

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
