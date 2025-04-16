from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.workflow_engine.endpoints.validators.base import BaseDataConditionValidator
from sentry.workflow_engine.models import DataCondition, DataConditionGroup


class BaseDataConditionGroupValidator(CamelSnakeSerializer):
    logic_type = serializers.ChoiceField([(t.value, t.value) for t in DataConditionGroup.Type])
    # TODO - set via context or create a custom field serializer
    organization_id = serializers.IntegerField(required=True)
    conditions = serializers.ListField(required=False)

    def validate_conditions(self, value) -> list[DataCondition]:
        conditions: list[DataCondition] = []

        for condition in value:
            condition_validator = BaseDataConditionValidator(data=condition)
            condition_validator.is_valid(raise_exception=True)

            # TODO Use the validator.create() method when it exists
            condition = DataCondition(condition_validator.validated_data)
            conditions.append(condition)

        return conditions
