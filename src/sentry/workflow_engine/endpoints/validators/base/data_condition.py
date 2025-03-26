from rest_framework import serializers

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.workflow_engine.models import Condition


class BaseDataConditionValidator(CamelSnakeSerializer):
    type = serializers.CharField(
        required=True,
        max_length=200,
    )

    comparison = serializers.JSONField(required=True)
    condition_result = serializers.JSONField(required=True)
    # condition_group

    def validate_type(self, value):
        try:
            vaildated_type = Condition(value)
        except ValueError:
            raise serializers.ValidationError(f"Invalid DataCondition.type: {value}")

        return vaildated_type

    def validate_comparison(self, value):
        # TODO - validate against schema
        # handler = self._get_handler_handler()
        # schema = handler.comparison_json_schmea
        # validate_json(value, schema)
        return value

    def validate_condition_result(self, value):
        if isinstance(value, (dict, list)):
            raise serializers.ValidationError(
                f"Invalid DataCondition.condition_result, {value}, must be a primitive value"
            )

        return value

    def validate_condition_group(self, value):
        # TODO - validate that the condition group exists
        # TODO - validate they have permissions to access the group?
        return value
