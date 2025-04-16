from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base.workflow import WorkflowValidator
from sentry.workflow_engine.models import Action, Condition, DataConditionGroupAction
from tests.sentry.workflow_engine.test_base import MockActionHandler


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

    @mock.patch(
        "sentry.workflow_engine.registry.action_handler_registry.get",
        return_value=MockActionHandler,
    )
    def test_valid_data__with_action_filters(self, mock_action_handler):
        self.valid_data["actionFilters"] = [
            {
                **self.valid_data["triggers"],
                "actions": [
                    {
                        "type": Action.Type.SLACK,
                        "config": {"foo": "bar"},
                        "data": {"baz": "bar"},
                        "integrationId": 1,
                    }
                ],
            }
        ]

        validator = WorkflowValidator(data=self.valid_data)
        assert validator.is_valid() is True

    @mock.patch(
        "sentry.workflow_engine.registry.action_handler_registry.get",
        return_value=MockActionHandler,
    )
    def test_valid_data__with_invalid_action_filters(self, mock_action_handler):
        self.valid_data["actionFilters"] = [
            {
                **self.valid_data["triggers"],
                "actions": [
                    {
                        "type": Action.Type.SLACK,
                        "config": {},
                        "integrationId": 1,
                    }
                ],
            }
        ]

        validator = WorkflowValidator(data=self.valid_data)
        assert validator.is_valid() is False

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


class TestWorkflowValidatorCreate(TestCase):
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

    def test_create__simple(self):
        validator = WorkflowValidator(data=self.valid_data)
        assert validator.is_valid() is True
        workflow = validator.create(validator.validated_data)

        # workflow is created
        assert workflow.id is not None
        assert workflow.name == self.valid_data["name"]
        assert workflow.enabled == self.valid_data["enabled"]
        assert workflow.config == self.valid_data["config"]
        assert workflow.organization_id == self.organization.id

    def test_create__validate_triggers_empty(self):
        validator = WorkflowValidator(data=self.valid_data)
        assert validator.is_valid() is True

        workflow = validator.create(validator.validated_data)

        assert workflow.when_condition_group is not None
        assert workflow.when_condition_group.conditions.count() == 0

    def test_create__validate_triggers_with_conditions(self):
        self.valid_data["triggers"]["conditions"] = [
            {
                "type": Condition.EQUAL,
                "comparison": 1,
                "conditionResult": True,
            }
        ]

        validator = WorkflowValidator(data=self.valid_data)
        assert validator.is_valid() is True
        workflow = validator.create(validator.validated_data)

        trigger = workflow.when_condition_group
        assert trigger is not None
        assert trigger.conditions.count() == 1

        trigger_condition = trigger.conditions.first()
        assert trigger_condition is not None
        assert trigger_condition.type == Condition.EQUAL

    @mock.patch(
        "sentry.workflow_engine.registry.action_handler_registry.get",
        return_value=MockActionHandler,
    )
    def test_create__with_actions__creates_workflow_group(self, mock_action_handler):
        self.valid_data["actionFilters"] = [
            {
                "actions": [
                    {
                        "type": Action.Type.SLACK,
                        "config": {"foo": "bar"},
                        "data": {"baz": "bar"},
                        "integrationId": 1,
                    }
                ],
                "logicType": "any",
                "conditions": [],
                "organizationId": self.organization.id,
            }
        ]

        validator = WorkflowValidator(data=self.valid_data)
        assert validator.is_valid() is True
        workflow = validator.create(validator.validated_data)

        workflow_condition_group = workflow.workflowdataconditiongroup_set.first()
        assert workflow_condition_group is not None

        assert workflow_condition_group.condition_group.logic_type == "any"

    @mock.patch(
        "sentry.workflow_engine.registry.action_handler_registry.get",
        return_value=MockActionHandler,
    )
    def test_create__with_actions__creates_action_group(self, mock_action_handler):
        self.valid_data["actionFilters"] = [
            {
                "actions": [
                    {
                        "type": Action.Type.SLACK,
                        "config": {"foo": "bar"},
                        "data": {"baz": "bar"},
                        "integrationId": 1,
                    }
                ],
                "logicType": "any",
                "conditions": [],
                "organizationId": self.organization.id,
            }
        ]

        validator = WorkflowValidator(data=self.valid_data)
        assert validator.is_valid() is True
        workflow = validator.create(validator.validated_data)

        workflow_condition_group = workflow.workflowdataconditiongroup_set.first()
        assert workflow_condition_group is not None

        action_group_query = DataConditionGroupAction.objects.filter(
            condition_group=workflow_condition_group.condition_group
        )

        assert action_group_query.count() == 1
        action_group = action_group_query.first()
        assert action_group is not None

        # check the action / condition group
        assert action_group.action.type == Action.Type.SLACK
        assert action_group.condition_group.logic_type == "any"
