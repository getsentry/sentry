from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base.workflow import WorkflowValidator


class TestWorkflowValidator(TestCase):
    def setUp(self):
        self.valid_data = {
            "name": "test",
            "enabled": True,
            "actionFilters": [],
            "config": {
                "frequency": 30,
            },
            "organizationId": self.organization.id,
            "triggers": {
                "logicType": "any",
                "conditions": [],
                "organizationId": self.organization.id,
            },
        }

    def test_valid_data(self):
        validator = WorkflowValidator(data=self.valid_data)
        assert validator.is_valid() is True

    def test_valid_data__with_action_filters(self):
        self.valid_data["actionFilters"] = [self.valid_data["triggers"]]
        validator = WorkflowValidator(data=self.valid_data)
        assert validator.is_valid() is True

    def test_invalid_data__no_name(self):
        self.valid_data["name"] = ""
        validator = WorkflowValidator(data=self.valid_data)
        assert validator.is_valid() is False

    def test_invalid_data__incorrect_config(self):
        self.valid_data["config"] = {"foo": "bar"}
        validator = WorkflowValidator(data=self.valid_data)
        assert validator.is_valid() is False

    def test_invalid_data__invalid_trigger(self):
        self.valid_data["triggers"] = {"foo": "bar"}
        validator = WorkflowValidator(data=self.valid_data)
        assert validator.is_valid() is False
