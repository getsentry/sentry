from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseWorkflowValidator


class TestBaseWorkflowValidator(TestCase):
    def setUp(self):
        self.condition_group = self.create_data_condition_group()

        self.valid_when_condition_group = {
            "logic_type": "any",
            "organization_id": self.organization.id,
            "conditions": [],
        }

        self.min_valid_data = {
            "name": "test",
            "organization": self.organization.id,
            "createdById": self.user.id,
            "enabled": True,
            "environmentId": None,
            "config": {},
            "whenConditionGroup": self.valid_when_condition_group,
            "actions": [],
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
            "foo": "bar",
        }

        validator = BaseWorkflowValidator(data=self.min_valid_data)
        result = validator.is_valid()

        assert result is False

    def test_validate__when_condition_group__valid(self):
        validator = BaseWorkflowValidator(data=self.min_valid_data)
        result = validator.is_valid()
        assert result is True

    def test_validate__when_condition_group__invalid(self):
        invalid_condition_group = {"logic_type": False}
        self.min_valid_data["whenConditionGroup"] = invalid_condition_group
        validator = BaseWorkflowValidator(data=self.min_valid_data)
        result = validator.is_valid()

        assert result is False

    def test_validate__actions__min_valid(self):
        self.min_valid_data["actions"] = [
            {
                "logic_type": "any",
                "organization_id": self.organization.id,
                "conditions": [],
            },
        ]

        validator = BaseWorkflowValidator(data=self.min_valid_data)
        result = validator.is_valid()

        assert result is True
