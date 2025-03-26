import pytest
from rest_framework.exceptions import ValidationError

from sentry.incidents.endpoints.validators.numeric_comparison_validator import (
    NumericComparisonConditionValidator,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.workflow_engine.endpoints.test_validators import BaseValidatorTest


class TestNumericComparisonConditionValidator(BaseValidatorTest):
    def setUp(self):
        super().setUp()

        # Create a concrete implementation for testing
        class ConcreteNumericValidator(NumericComparisonConditionValidator):
            @property
            def supported_conditions(self):
                return frozenset([Condition.GREATER, Condition.LESS])

            @property
            def supported_condition_results(self):
                return frozenset([DetectorPriorityLevel.HIGH, DetectorPriorityLevel.LOW])

        self.validator_class = ConcreteNumericValidator

    def test_validate_condition_valid(self):
        validator = self.validator_class()
        assert validator.validate_type("gt") == Condition.GREATER

    def test_validate_condition_invalid(self):
        validator = self.validator_class()
        with pytest.raises(
            ValidationError,
            match="[ErrorDetail(string='Unsupported type invalid_condition', code='invalid')]",
        ):
            validator.validate_type("invalid_condition")

    def test_validate_result_valid(self):
        validator = self.validator_class()
        assert validator.validate_condition_result("75") == DetectorPriorityLevel.HIGH

    def test_validate_result_invalid(self):
        validator = self.validator_class()
        with pytest.raises(
            ValidationError,
            match="[ErrorDetail(string='Unsupported condition result', code='invalid')]",
        ):
            validator.validate_condition_result("invalid_result")
