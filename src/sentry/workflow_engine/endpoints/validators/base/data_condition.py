from rest_framework import serializers
from rest_framework.fields import Field

from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


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


class NumericComparisonConditionValidator(BaseDataConditionValidator):
    comparison = serializers.FloatField(
        required=True,
        help_text="Comparison value to be compared against value from data.",
    )
    condition_result = serializers.ChoiceField(
        choices=[
            (DetectorPriorityLevel.HIGH, "High"),
            (DetectorPriorityLevel.MEDIUM, "Medium"),
            (DetectorPriorityLevel.LOW, "Low"),
        ]
    )

    @property
    def supported_conditions(self) -> frozenset[Condition]:
        raise NotImplementedError

    @property
    def supported_condition_results(self) -> frozenset[DetectorPriorityLevel]:
        raise NotImplementedError

    def validate_type(self, value: str) -> Condition:
        try:
            type = Condition(value)
        except ValueError:
            type = None

        if type not in self.supported_conditions:
            raise serializers.ValidationError(f"Unsupported type {value}")
        return type

    def validate_condition_result(self, value: str) -> DetectorPriorityLevel:
        try:
            result = DetectorPriorityLevel(int(value))
        except ValueError:
            result = None
        if result not in self.supported_condition_results:
            raise serializers.ValidationError("Unsupported condition result")
        return result
