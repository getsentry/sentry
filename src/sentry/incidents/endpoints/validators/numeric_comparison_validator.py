from rest_framework import serializers

from sentry.workflow_engine.endpoints.validators.base.data_condition import (
    BaseDataConditionValidator,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel


class NumericComparisonConditionValidator(BaseDataConditionValidator):
    type = serializers.ChoiceField(choices=[(t.value, t.value) for t in Condition])
    comparison = serializers.JSONField(required=True)
    condition_result = serializers.JSONField(required=True)

    @property
    def supported_conditions(self) -> frozenset[Condition]:
        raise NotImplementedError

    @property
    def supported_condition_results(self) -> frozenset[DetectorPriorityLevel]:
        raise NotImplementedError

    def validate_comparison(self, value: float | int | str) -> float:
        try:
            value = float(value)
        except ValueError:
            raise serializers.ValidationError("Invalid NumericComparisonCondition.comparison")

        return value

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
