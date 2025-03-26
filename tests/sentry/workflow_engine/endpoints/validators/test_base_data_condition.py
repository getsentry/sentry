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

    def test_conditions__invalid_condition(self):
        invalid_data = {"comparison": 0}
        validator = BaseDataConditionValidator(data=invalid_data)
        assert validator.is_valid() is False

    def test_conditions__invalid_condition_type(self):
        invalid_data = {"type": "invalid-type"}
        validator = BaseDataConditionValidator(data=invalid_data)
        assert validator.is_valid() is False
