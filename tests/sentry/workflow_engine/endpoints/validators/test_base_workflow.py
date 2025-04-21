from unittest import mock

import pytest
from rest_framework.serializers import ValidationError

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.serializers import WorkflowSerializer
from sentry.workflow_engine.endpoints.validators.base.workflow import WorkflowValidator
from sentry.workflow_engine.models import (
    Action,
    Condition,
    DataConditionGroup,
    DataConditionGroupAction,
)
from tests.sentry.workflow_engine.test_base import MockActionHandler


class TestWorkflowValidator(TestCase):
    def setUp(self):
        self.context = {
            "organization": self.organization,
            "request": self.make_request(),
        }

        self.valid_data = {
            "name": "test",
            "enabled": True,
            "actionFilters": [],
            "config": {
                "frequency": 30,
            },
            "triggers": {
                "logicType": "any",
                "conditions": [],
            },
        }

    def test_valid_data(self):
        validator = WorkflowValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid() is True

    @mock.patch(
        "sentry.workflow_engine.registry.action_handler_registry.get",
        return_value=MockActionHandler,
    )
    def test_valid_data__with_action_filters(self, mock_action_handler):
        self.valid_data["actionFilters"] = [
            {
                "logicType": "any",
                "conditions": [],
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

        validator = WorkflowValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid() is True

    @mock.patch(
        "sentry.workflow_engine.registry.action_handler_registry.get",
        return_value=MockActionHandler,
    )
    def test_valid_data__with_invalid_action_filters(self, mock_action_handler):
        self.valid_data["actionFilters"] = [
            {
                "logicType": "any",
                "conditions": [],
                "actions": [
                    {
                        "type": Action.Type.SLACK,
                        "config": {},
                        "integrationId": 1,
                    }
                ],
            }
        ]

        validator = WorkflowValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid() is False

    def test_invalid_data__no_name(self):
        self.valid_data["name"] = ""
        validator = WorkflowValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid() is False

    def test_invalid_data__incorrect_config(self):
        self.valid_data["config"] = {"foo": "bar"}
        validator = WorkflowValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid() is False

    def test_invalid_data__invalid_trigger(self):
        self.valid_data["triggers"] = {"foo": "bar"}
        validator = WorkflowValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid() is False


class TestWorkflowValidatorCreate(TestCase):
    def setUp(self):
        self.context = {
            "organization": self.organization,
            "request": self.make_request(),
        }

        self.valid_data = {
            "name": "test",
            "enabled": True,
            "actionFilters": [],
            "config": {
                "frequency": 30,
            },
            "triggers": {
                "logicType": "any",
                "conditions": [],
            },
        }

    def test_create__simple(self):
        validator = WorkflowValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid() is True
        workflow = validator.create(validator.validated_data)

        # workflow is created
        assert workflow.id is not None
        assert workflow.name == self.valid_data["name"]
        assert workflow.enabled == self.valid_data["enabled"]
        assert workflow.config == self.valid_data["config"]
        assert workflow.organization_id == self.organization.id

    def test_create__validate_triggers_empty(self):
        validator = WorkflowValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid() is True

        workflow = validator.create(validator.validated_data)

        assert workflow.when_condition_group is not None
        assert workflow.when_condition_group.conditions.count() == 0

    def test_create__validate_triggers_with_conditions(self):
        self.valid_data["triggers"] = {
            "logicType": "any",
            "conditions": [
                {
                    "type": Condition.EQUAL,
                    "comparison": 1,
                    "conditionResult": True,
                }
            ],
        }

        validator = WorkflowValidator(data=self.valid_data, context=self.context)
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

        validator = WorkflowValidator(data=self.valid_data, context=self.context)
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

        validator = WorkflowValidator(data=self.valid_data, context=self.context)
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


class TestWorkflowValidatorUpdate(TestCase):
    def setUp(self):
        self.context = {
            "organization": self.organization,
            "request": self.make_request(),
        }

        self.action_filters = [
            {
                "actions": [
                    {
                        "type": Action.Type.SLACK,
                        "config": {
                            "target_identifier": "foo",
                            "target_display": "bar",
                            "target_type": 0,
                        },
                        "data": {},
                        "integrationId": 1,
                    }
                ],
                "logicType": "any",
                "conditions": [],
                "organizationId": self.organization.id,
            }
        ]

        self.valid_data = {
            "name": "test",
            "enabled": True,
            "actionFilters": self.action_filters,
            "config": {
                "frequency": 30,
            },
            "triggers": {
                "logicType": "any",
                "conditions": [
                    {
                        "type": Condition.EQUAL,
                        "comparison": 1,
                        "condition_result": True,
                    },
                ],
            },
        }

        validator = WorkflowValidator(
            data=self.valid_data,
            context=self.context,
        )

        validator.is_valid(raise_exception=True)
        self.workflow = validator.create(validator.validated_data)

        serializer = WorkflowSerializer()
        attrs = serializer.get_attrs([self.workflow], self.user)
        self.valid_saved_data = serializer.serialize(self.workflow, attrs[self.workflow], self.user)

    def test_update_property(self):
        self.valid_data["name"] = "Update Test"
        validator = WorkflowValidator(data=self.valid_data, context=self.context)

        assert validator.is_valid() is True
        workflow = validator.update(self.workflow, validator.validated_data)

        assert workflow.id == self.workflow.id
        assert workflow.name == "Update Test"

    def test_update__remove_triggers(self):
        assert self.workflow.when_condition_group

        self.valid_saved_data["triggers"] = {
            "id": self.workflow.when_condition_group.id,
            "logicType": "any",
            "conditions": [],
        }

        validator = WorkflowValidator(data=self.valid_saved_data, context=self.context)
        assert validator.is_valid() is True

        validator.update(self.workflow, validator.validated_data)
        self.workflow.refresh_from_db()

        assert self.workflow.when_condition_group is not None
        assert self.workflow.when_condition_group.conditions.count() == 0

    def test_update__hax_to_replace_group(self):
        fake_dcg = DataConditionGroup.objects.create(
            organization=self.organization,
            logic_type="any",
        )

        self.valid_saved_data["triggers"] = {
            "id": fake_dcg.id,
            "logicType": "any",
            "conditions": [],
        }

        validator = WorkflowValidator(data=self.valid_saved_data, context=self.context)
        assert validator.is_valid() is True

        with pytest.raises(ValidationError):
            validator.update(self.workflow, validator.validated_data)
