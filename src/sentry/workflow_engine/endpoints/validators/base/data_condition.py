from rest_framework import serializers
from rest_framework.fields import Field

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.workflow_engine.models import Condition


class BaseDataConditionValidator(CamelSnakeSerializer):
    type = serializers.CharField(
        required=True,
        max_length=200,
    )

    def validate_type(self, value):
        try:
            vaildated_type = Condition(value)
        except ValueError:
            raise serializers.ValidationError(f"Invalid Condition.type: {value}")

        return vaildated_type

    @property
    def comparison(self) -> Field:
        raise NotImplementedError

    @property
    def result(self) -> Field:
        raise NotImplementedError
