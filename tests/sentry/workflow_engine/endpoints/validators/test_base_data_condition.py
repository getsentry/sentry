from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseDataConditionValidator
from sentry.workflow_engine.models import Condition


class TestBaseDataConditionValidator(TestCase):
    def setUp(self):
        self.condition_group = self.create_data_condition_group()
        self.valid_data = {
            "type": Condition.EQUAL,
            "comparison": 1,
            "condition_result": True,
            "condition_group": self.condition_group.id,
        }

    def test_conditions__valid_condition(self):
        validator = BaseDataConditionValidator(data=self.valid_data)
        assert validator.is_valid() is True

    def test_conditions__no_type(self):
        invalid_data = {"comparison": 0}
        validator = BaseDataConditionValidator(data=invalid_data)
        assert validator.is_valid() is False

    def test_conditions__invalid_condition_type(self):
        invalid_data = {**self.valid_data, "type": "invalid-type"}
        validator = BaseDataConditionValidator(data=invalid_data)
        assert validator.is_valid() is False

    def test_comparison__no_comparison(self):
        invalid_data = {"type": Condition.EQUAL}
        validator = BaseDataConditionValidator(data=invalid_data)
        assert validator.is_valid() is False

    # TODO - do we need to compare to null ever? probably?
    # def test_comparison__null_works(self):
    #     invalid_data = {**self.valid_data, "comparison": None}
    #     validator = BaseDataConditionValidator(data=invalid_data)
    #     assert validator.is_valid() is True

    def test_comparison__primitive_value(self):
        valid_data = {**self.valid_data, "comparison": 1}
        validator = BaseDataConditionValidator(data=valid_data)
        assert validator.is_valid() is True

    def test_comparison__complex_value(self):
        # TODO - add validation for the json field
        # -- this requires a lookup to the dictionary via the type, then getting the schema
        valid_data = {**self.valid_data, "comparison": {"key": "value"}}
        validator = BaseDataConditionValidator(data=valid_data)
        assert validator.is_valid() is True

    def test_condition_result__primitive_value__bool(self):
        valid_data = {**self.valid_data, "condition_result": True}
        validator = BaseDataConditionValidator(data=valid_data)
        assert validator.is_valid() is True

    def test_condition_result__primitive_value__int(self):
        valid_data = {**self.valid_data, "condition_result": 1}
        validator = BaseDataConditionValidator(data=valid_data)
        assert validator.is_valid() is True

    def test_condition_result__primitive_value__string(self):
        valid_data = {**self.valid_data, "condition_result": "foo"}
        validator = BaseDataConditionValidator(data=valid_data)
        assert validator.is_valid() is True

    def test_condition_result__complex_value__dict(self):
        invalid_data = {**self.valid_data, "condition_result": {"key": "value"}}
        validator = BaseDataConditionValidator(data=invalid_data)
        assert validator.is_valid() is False

    def test_condition_result__complex_value__array(self):
        invalid_data = {**self.valid_data, "condition_result": ["foo"]}
        validator = BaseDataConditionValidator(data=invalid_data)
        assert validator.is_valid() is False
