from unittest import mock

import pytest
from rest_framework.exceptions import ErrorDetail
from rest_framework.serializers import ValidationError

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.serializers import WorkflowSerializer
from sentry.workflow_engine.endpoints.validators.base.workflow import WorkflowValidator
from sentry.workflow_engine.models import (
    Action,
    Condition,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Workflow,
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
            "request": self.make_request(user=self.user),
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
        assert workflow.created_by_id == self.user.id

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

    def test_create__exceeds_workflow_limit(self):
        REGULAR_LIMIT = 2
        with self.settings(MAX_WORKFLOWS_PER_ORG=REGULAR_LIMIT):
            # Create first workflow - should succeed
            validator = WorkflowValidator(data=self.valid_data, context=self.context)
            validator.is_valid(raise_exception=True)
            workflow = validator.create(validator.validated_data)
            assert workflow.id is not None

            # Create second workflow - should succeed
            self.valid_data["name"] = "test2"
            validator = WorkflowValidator(data=self.valid_data, context=self.context)
            validator.is_valid(raise_exception=True)
            workflow = validator.create(validator.validated_data)
            assert workflow.id is not None

            # Try to create third workflow - should fail
            self.valid_data["name"] = "test3"
            validator = WorkflowValidator(data=self.valid_data, context=self.context)
            validator.is_valid(raise_exception=True)
            with pytest.raises(ValidationError) as excinfo:
                validator.create(validator.validated_data)
            assert excinfo.value.detail == [
                ErrorDetail(
                    string=f"You may not exceed {REGULAR_LIMIT} workflows per organization.",
                    code="invalid",
                )
            ]

    def test_create__exceeds_more_workflow_limit(self):
        REGULAR_LIMIT = 2
        MORE_LIMIT = 4
        with self.settings(
            MAX_WORKFLOWS_PER_ORG=REGULAR_LIMIT, MAX_MORE_WORKFLOWS_PER_ORG=MORE_LIMIT
        ):
            # First verify regular limit is enforced without the feature flag
            # Create first REGULAR_LIMIT workflows - should succeed
            for i in range(REGULAR_LIMIT):
                self.valid_data["name"] = f"test{i}"
                validator = WorkflowValidator(data=self.valid_data, context=self.context)
                validator.is_valid(raise_exception=True)
                workflow = validator.create(validator.validated_data)
                assert workflow.id is not None

            # Try to create workflow beyond regular limit - should fail
            self.valid_data["name"] = f"test{REGULAR_LIMIT}"
            validator = WorkflowValidator(data=self.valid_data, context=self.context)
            validator.is_valid(raise_exception=True)
            with pytest.raises(ValidationError) as excinfo:
                validator.create(validator.validated_data)
            assert excinfo.value.detail == [
                ErrorDetail(
                    string=f"You may not exceed {REGULAR_LIMIT} workflows per organization.",
                    code="invalid",
                )
            ]

            # Now enable the feature flag and verify higher limit
            with self.feature("organizations:more-workflows"):
                # Create workflows up to MORE_LIMIT - should succeed
                for i in range(REGULAR_LIMIT, MORE_LIMIT):
                    self.valid_data["name"] = f"test{i}"
                    validator = WorkflowValidator(data=self.valid_data, context=self.context)
                    validator.is_valid(raise_exception=True)
                    workflow = validator.create(validator.validated_data)
                    assert workflow.id is not None

                # Try to create workflow beyond more limit - should fail
                self.valid_data["name"] = f"test{MORE_LIMIT}"
                validator = WorkflowValidator(data=self.valid_data, context=self.context)
                validator.is_valid(raise_exception=True)
                with pytest.raises(ValidationError) as excinfo:
                    validator.create(validator.validated_data)
                assert excinfo.value.detail == [
                    ErrorDetail(
                        string=f"You may not exceed {MORE_LIMIT} workflows per organization.",
                        code="invalid",
                    )
                ]


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
        self.context["workflow"] = self.workflow

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

    def test_update__remove_trigger_conditions(self):
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

    def test_update__hack_attempt_to_override_different_trigger_condition(self):
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

    def test_update__remove_action_filter(self):
        self.valid_saved_data["actionFilters"] = []

        validator = WorkflowValidator(data=self.valid_saved_data, context=self.context)
        assert validator.is_valid() is True

        validator.update(self.workflow, validator.validated_data)
        self.workflow.refresh_from_db()

        assert self.workflow.workflowdataconditiongroup_set.count() == 0

    def test_update__add_new_filter(self):
        self.valid_saved_data["actionFilters"].append(
            {
                "actions": [
                    {
                        "type": Action.Type.SLACK,
                        "config": {
                            "targetIdentifier": "bar",
                            "targetDisplay": "baz",
                            "targetType": 0,
                        },
                        "data": {},
                        "integrationId": 1,
                    }
                ],
                "logicType": "all",
                "conditions": [],
                "organizationId": self.organization.id,
            }
        )

        validator = WorkflowValidator(data=self.valid_saved_data, context=self.context)
        assert validator.is_valid() is True

        validator.update(self.workflow, validator.validated_data)
        self.workflow.refresh_from_db()

        assert self.workflow.workflowdataconditiongroup_set.count() == 2

    def test_update__remove_one_filter(self):
        # Configuration for the test
        self.workflow.workflowdataconditiongroup_set.create(
            condition_group=DataConditionGroup.objects.create(
                organization=self.organization,
                logic_type="any",
            )
        )

        assert self.workflow.workflowdataconditiongroup_set.count() == 2
        serializer = WorkflowSerializer()
        attrs = serializer.get_attrs([self.workflow], self.user)
        self.valid_saved_data = serializer.serialize(self.workflow, attrs[self.workflow], self.user)

        self.valid_saved_data["actionFilters"].pop(0)
        validator = WorkflowValidator(data=self.valid_saved_data, context=self.context)
        assert validator.is_valid() is True

        # The evaluation
        validator.update(self.workflow, validator.validated_data)
        self.workflow.refresh_from_db()

        assert self.workflow.workflowdataconditiongroup_set.count() == 1

    def _get_first_trigger_condition(self, workflow: Workflow) -> DataCondition:
        if workflow.when_condition_group is None:
            raise AssertionError("Cannot find initial condition")

        first_condition = workflow.when_condition_group.conditions.first()
        if first_condition is None:
            raise AssertionError("Cannot find initial condition")

        return first_condition

    def test_update__data_condition(self):
        first_condition = self._get_first_trigger_condition(self.workflow)
        assert first_condition.comparison == 1

        updated_condition = self.valid_saved_data["triggers"]["conditions"][0]
        updated_condition["comparison"] = 2
        self.valid_saved_data["triggers"]["conditions"][0] = updated_condition

        validator = WorkflowValidator(data=self.valid_saved_data, context=self.context)
        assert validator.is_valid() is True
        validator.update(self.workflow, validator.validated_data)
        self.workflow.refresh_from_db()

        first_condition = self._get_first_trigger_condition(self.workflow)
        assert first_condition.comparison == updated_condition["comparison"]

    def test_update__remove_one_data_condition(self):
        # Setup the test
        assert self.workflow.when_condition_group
        assert self.workflow.when_condition_group.conditions.count() == 1
        dc = self.workflow.when_condition_group.conditions.create(
            type=Condition.EQUAL,
            comparison=2,
            condition_result=False,
        )
        assert self.workflow.when_condition_group.conditions.count() == 2
        serializer = WorkflowSerializer()
        attrs = serializer.get_attrs([self.workflow], self.user)
        self.valid_saved_data = serializer.serialize(self.workflow, attrs[self.workflow], self.user)

        # Make the update
        self.valid_saved_data["triggers"]["conditions"].pop(0)

        validator = WorkflowValidator(data=self.valid_saved_data, context=self.context)
        assert validator.is_valid() is True
        validator.update(self.workflow, validator.validated_data)
        self.workflow.refresh_from_db()

        # Check the results
        assert self.workflow.when_condition_group
        assert self.workflow.when_condition_group.conditions.count() == 1
        assert self.workflow.when_condition_group.conditions.first() == dc

    def test_update__add_new_action(self):
        self.valid_saved_data["actionFilters"][0]["actions"].append(
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
        )

        validator = WorkflowValidator(data=self.valid_saved_data, context=self.context)
        assert validator.is_valid() is True
        validator.update(self.workflow, validator.validated_data)

    def test_update__modify_action(self):
        workflow_condition_group = self.workflow.workflowdataconditiongroup_set.first()
        assert workflow_condition_group is not None
        action_condition_group = (
            workflow_condition_group.condition_group.dataconditiongroupaction_set.first()
        )
        assert action_condition_group is not None

        action = action_condition_group.action
        assert action.type == Action.Type.SLACK

        # Update the data for the action
        self.valid_saved_data["actionFilters"][0]["actions"] = [
            {
                "id": action.id,
                "type": Action.Type.EMAIL,
                "config": {
                    "target_identifier": "foo",
                    "target_type": 0,
                },
                "data": {},
            }
        ]

        validator = WorkflowValidator(data=self.valid_saved_data, context=self.context)
        assert validator.is_valid() is True
        validator.update(self.workflow, validator.validated_data)
        self.workflow.refresh_from_db()

        assert self.workflow.workflowdataconditiongroup_set.count() == 1

        workflow_condition_group = self.workflow.workflowdataconditiongroup_set.first()
        assert workflow_condition_group is not None
        action_condition_group = (
            workflow_condition_group.condition_group.dataconditiongroupaction_set.first()
        )
        assert action_condition_group is not None

        updated_action = action_condition_group.action
        assert updated_action.id == action.id
        assert updated_action.type == Action.Type.EMAIL

    def test_update__remove_one_action(self):
        workflow_condition_group = self.workflow.workflowdataconditiongroup_set.first()
        assert workflow_condition_group is not None
        new_action = Action.objects.create(
            type=Action.Type.EMAIL,
            config={
                "target_identifier": "foo",
                "target_type": 0,
            },
            data={},
            integration_id=1,
        )

        workflow_condition_group.condition_group.dataconditiongroupaction_set.create(
            action=new_action,
        )

        # confirm there are two actions for this condition group
        assert workflow_condition_group.condition_group.dataconditiongroupaction_set.count() == 2

        # remove new_action from the groups actions
        validator = WorkflowValidator(data=self.valid_saved_data, context=self.context)
        assert validator.is_valid() is True
        validator.update(self.workflow, validator.validated_data)

        assert workflow_condition_group.condition_group.dataconditiongroupaction_set.count() == 1
        action_condition_group = (
            workflow_condition_group.condition_group.dataconditiongroupaction_set.first()
        )
        assert action_condition_group is not None
        assert action_condition_group.action.id != new_action.id
        assert action_condition_group.action.type == Action.Type.SLACK

    def test_update__remove_all_actions(self):
        self.valid_saved_data["actionFilters"][0]["actions"] = []
        validator = WorkflowValidator(data=self.valid_saved_data, context=self.context)
        assert validator.is_valid() is True
        validator.update(self.workflow, validator.validated_data)

        workflow_condition_group = self.workflow.workflowdataconditiongroup_set.first()
        assert workflow_condition_group is not None
        assert workflow_condition_group.condition_group.dataconditiongroupaction_set.count() == 0
