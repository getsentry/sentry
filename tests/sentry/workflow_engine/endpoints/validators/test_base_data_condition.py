from unittest import mock

from rest_framework import serializers

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseDataConditionValidator
from sentry.workflow_engine.models import Condition
from sentry.workflow_engine.types import DataConditionHandler
from tests.sentry.workflow_engine.test_base import MockModel


class MockDataConditionHandler(DataConditionHandler):
    comparison_json_schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "description": "The configuration schema for a Data Condition Comparison",
        "type": "object",
        "properties": {
            "foo": {
                "type": ["string"],
            },
        },
        "required": ["foo"],
        "additionalProperties": False,
    }


class MockConditionValidator(BaseDataConditionValidator[MockModel]):
    field1 = serializers.CharField()

    class Meta:
        model = MockModel
        fields = "__all__"


class TestBaseDataConditionValidator(TestCase):
    def setUp(self):
        self.condition_group = self.create_data_condition_group()
        self.valid_data = {
            "field1": "test",
            "type": Condition.EQUAL,
            "comparison": 1,
            "condition_result": True,
            "condition_group": self.condition_group.id,
        }

    def test_conditions__valid_condition(self):
        validator = MockConditionValidator(data=self.valid_data)
        assert validator.is_valid() is True

    def test_conditions__no_type(self):
        invalid_data = {"comparison": 0}
        validator = MockConditionValidator(data=invalid_data)
        assert validator.is_valid() is False

    def test_conditions__invalid_condition_type(self):
        invalid_data = {**self.valid_data, "type": "invalid-type"}
        validator = MockConditionValidator(data=invalid_data)
        assert validator.is_valid() is False

    def test_comparison__no_comparison(self):
        invalid_data = {"type": Condition.EQUAL}
        validator = MockConditionValidator(data=invalid_data)
        assert validator.is_valid() is False

    def test_comparison__primitive_value(self):
        valid_data = {**self.valid_data, "comparison": 1}
        validator = MockConditionValidator(data=valid_data)
        assert validator.is_valid() is True

    @mock.patch(
        "sentry.workflow_engine.registry.condition_handler_registry.get",
        return_value=MockDataConditionHandler,
    )
    def test_comparison__complex_value(self, mock_handler_get):
        valid_data = {
            **self.valid_data,
            "type": Condition.AGE_COMPARISON,
            "comparison": {"foo": "bar"},
        }
        validator = MockConditionValidator(data=valid_data)
        assert validator.is_valid() is True

    @mock.patch(
        "sentry.workflow_engine.registry.condition_handler_registry.get",
        return_value=MockDataConditionHandler(),
    )
    def test_comparison__complex_value__invalid(self, mock_handler_get):
        valid_data = {
            **self.valid_data,
            "type": Condition.AGE_COMPARISON,
            "comparison": {"invalid": "value"},
        }
        validator = MockConditionValidator(data=valid_data)
        assert validator.is_valid() is False

    def test_condition_result__primitive_value__bool(self):
        valid_data = {**self.valid_data, "condition_result": True}
        validator = MockConditionValidator(data=valid_data)
        assert validator.is_valid() is True

    def test_condition_result__primitive_value__int(self):
        valid_data = {**self.valid_data, "condition_result": 1}
        validator = MockConditionValidator(data=valid_data)
        assert validator.is_valid() is True

    def test_condition_result__primitive_value__string(self):
        valid_data = {**self.valid_data, "condition_result": "foo"}
        validator = MockConditionValidator(data=valid_data)
        assert validator.is_valid() is True

    def test_condition_result__complex_value__dict(self):
        invalid_data = {**self.valid_data, "condition_result": {"key": "value"}}
        validator = MockConditionValidator(data=invalid_data)
        assert validator.is_valid() is False

    def test_condition_result__complex_value__array(self):
        invalid_data = {**self.valid_data, "condition_result": ["foo"]}
        validator = MockConditionValidator(data=invalid_data)
        assert validator.is_valid() is False
