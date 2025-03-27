from rest_framework import serializers
from rest_framework.fields import Field

from sentry.api.serializers.rest_framework import CamelSnakeSerializer


class BaseDataConditionValidator(CamelSnakeSerializer):
    type = serializers.CharField(
        required=True,
        max_length=200,
        help_text="Condition used to compare data value to the stored comparison value",
    )

    @property
    def comparison(self) -> Field:
        raise NotImplementedError

    @property
    def result(self) -> Field:
        raise NotImplementedError

    def validate(self, attrs):
        attrs = super().validate(attrs)
        return attrs


class BaseDataConditionGroupValidator(CamelSnakeSerializer):
    logic_type = serializers.CharField(required=True)
    organization_id = serializers.IntegerField(required=True)
    conditions = BaseDataConditionValidator(many=True)
