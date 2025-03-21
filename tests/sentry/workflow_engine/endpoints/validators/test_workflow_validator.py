from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseWorkflowValidator


class TestBaseWorkflowValidator(TestCase):
    def setUp(self):
        self.condition_group = self.create_data_condition_group()

        self.min_valid_data = {
            "name": "test",
            "organization": self.organization.id,
            "config": {},
            "createdById": self.user.id,
            "enabled": True,
            "environmentId": None,
            "whenConditionGroup": self.condition_group.id,
        }

    def test_validate__valid(self):
        validator = BaseWorkflowValidator(data=self.min_valid_data)
        result = validator.is_valid()

        assert result is True

    def test_validate__detailed_config__valid(self):
        self.min_valid_data["config"] = {
            "frequency": 1,
        }
        validator = BaseWorkflowValidator(data=self.min_valid_data)
        result = validator.is_valid()

        assert result is True

    def test_validate__detailed_config__invalid(self):
        self.min_valid_data["config"] = {
            "narp": 1,
        }

        validator = BaseWorkflowValidator(data=self.min_valid_data)
        result = validator.is_valid()

        assert result is False
