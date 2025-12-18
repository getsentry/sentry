from copy import deepcopy
from random import randint
from typing import TypedDict, Unpack

from django.db.models import Count

from sentry.models.organization import Organization
from sentry.rules import MatchType
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import (
    Action,
    AlertRuleWorkflow,
    DataCondition,
    DetectorWorkflow,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition


class MockWorkflowConfig(TypedDict, total=False):
    actions: list[Action] | None
    action_filters: list[DataCondition] | None
    enabled: bool | None
    triggers: list[DataCondition] | None
    mock_actions: bool
    mock_action_filters: bool
    mock_triggers: bool


# This is a list of workflows to create for every test case.
# This will help determine if we ever over match on the different cases
DEFAULT_WORKFLOW_CONFIGS: list[MockWorkflowConfig] = [
    {
        # mock everything
    },
    {
        # workflow only has triggers
        "mock_action_filters": False,
        "mock_actions": False,
    },
    {
        # workflow has triggers + filters, no actions
        "mock_actions": False,
    },
    {
        # workflow only has filters
        "mock_triggers": False,
        "mock_actions": False,
    },
    {
        # workflow only has actions
        "mock_triggers": False,
        "mock_action_filters": False,
    },
    {
        # All workflows are duplicated in this org
        "mock_triggers": False,
        "mock_action_filters": False,
        "mock_actions": False,
    },
    {
        "enabled": False,
    },
]


# This is list is used to generate the different cases for a workflow to be a duplicate of itself
# Then it's used to reference those mocks, and ensure each case is deduplicated as expected.
DUPLICATE_WORKFLOW_CONFIGS: list[MockWorkflowConfig] = [
    {
        # mock everything
    },
    {
        # workflow only has triggers
        "mock_action_filters": False,
        "mock_actions": False,
    },
    {
        # workflow has triggers + filters, no actions
        "mock_actions": False,
    },
    {
        # workflow only has filters
        "mock_triggers": False,
        "mock_actions": False,
    },
    {
        # workflow only has actions
        "mock_triggers": False,
        "mock_action_filters": False,
    },
    {
        # multiple triggers
        "triggers": [
            DataCondition(
                type=Condition.ASSIGNED_TO,
                comparison={
                    "target_type": "Team",
                    "target_identifier": "user@sentry.io",
                },
                condition_result=True,
            ),
            DataCondition(
                type=Condition.ISSUE_RESOLUTION_CHANGE,
                condition_result=True,
                comparison=1,  # GroupStatus.RESOLVED
            ),
        ],
    },
    {
        # multiple action filters
        "action_filters": [
            DataCondition(
                type=Condition.EVENT_ATTRIBUTE,
                comparison={
                    "attribute": "user.email",
                    "match": MatchType.EQUAL,
                    "value": "user@sentry.io",
                },
                condition_result=True,
            ),
            DataCondition(
                type=Condition.TAGGED_EVENT,
                condition_result=True,
                comparison={
                    "key": "foo",
                    "match": MatchType.EQUAL,
                    "value": "bar",
                },
            ),
        ],
    },
    {
        # multiple actions
        "actions": [
            Action(
                type=Action.Type.EMAIL,
                config={
                    "target_identifier": "user@sentry.io",
                    "target_type": 2,
                },
                data={
                    "fallthrough_type": "NoOne",
                },
            ),
            Action(
                type=Action.Type.DISCORD,
                config={
                    "target_identifier": "#discord-channel",
                    "target_display": "Example Discord",
                    "target_type": 0,
                },
                data={"tags": "foo"},
            ),
        ],
    },
    {
        # triggers + action filters
        "triggers": [
            DataCondition(
                type=Condition.ASSIGNED_TO,
                comparison={
                    "target_type": "Team",
                    "target_identifier": "user@sentry.io",
                },
                condition_result=True,
            ),
            DataCondition(
                type=Condition.ISSUE_RESOLUTION_CHANGE,
                condition_result=True,
                comparison=1,  # GroupStatus.RESOLVED
            ),
        ],
        "action_filters": [
            DataCondition(
                type=Condition.EVENT_ATTRIBUTE,
                comparison={
                    "attribute": "user.email",
                    "match": MatchType.EQUAL,
                    "value": "user@sentry.io",
                },
                condition_result=True,
            ),
            DataCondition(
                type=Condition.TAGGED_EVENT,
                comparison={
                    "key": "foo",
                    "match": MatchType.EQUAL,
                    "value": "bar",
                },
                condition_result=True,
            ),
        ],
    },
    {
        # many of all
        "triggers": [
            DataCondition(
                type=Condition.ASSIGNED_TO,
                comparison={
                    "target_type": "Team",
                    "target_identifier": "user@sentry.io",
                },
                condition_result=True,
            ),
            DataCondition(
                type=Condition.ISSUE_RESOLUTION_CHANGE,
                condition_result=True,
                comparison=1,  # GroupStatus.RESOLVED
            ),
        ],
        "action_filters": [
            DataCondition(
                type=Condition.EVENT_ATTRIBUTE,
                comparison={
                    "attribute": "user.email",
                    "match": MatchType.EQUAL,
                    "value": "user@sentry.io",
                },
                condition_result=True,
            ),
            DataCondition(
                type=Condition.TAGGED_EVENT,
                comparison={
                    "key": "foo",
                    "match": MatchType.EQUAL,
                    "value": "bar",
                },
                condition_result=True,
            ),
        ],
        "actions": [
            Action(
                type=Action.Type.EMAIL,
                config={
                    "target_identifier": "user@sentry.io",
                    "target_type": 2,
                },
                data={
                    "fallthrough_type": "NoOne",
                },
            ),
            Action(
                type=Action.Type.DISCORD,
                config={
                    "target_identifier": "#discord-channel",
                    "target_display": "Example Discord",
                    "target_type": 0,
                },
                data={"tags": "foo"},
            ),
        ],
    },
    {
        # All workflows are duplicated in this org
        "mock_triggers": False,
        "mock_action_filters": False,
        "mock_actions": False,
    },
    {
        "enabled": False,
    },
]


class TestDeduplicateWorkflows(TestMigrations):
    """
    Each of the following tests are split up and not using parametrize because that doesn't work in these tests.
    Instead, this creates a test case per index, and evaluates them -- more or less re-creating parametrize.
    """

    migrate_from = "0104_action_data_fallthrough_type"
    migrate_to = "0105_deduplicate_workflows"
    app = "workflow_engine"

    def mock_workflow(self, org: Organization, **kwargs: Unpack[MockWorkflowConfig]) -> Workflow:
        config: MockWorkflowConfig = {
            "triggers": None,
            "action_filters": None,
            "actions": None,
            "enabled": True,
            "mock_triggers": True,
            "mock_action_filters": True,
            "mock_actions": True,
            **kwargs,
        }

        # create workflow
        workflow = self.create_workflow(organization=org, enabled=config["enabled"])

        # connect the workflow new a new detector
        detector = self.create_detector()
        self.create_detector_workflow(detector=detector, workflow=workflow)

        # create a mock connection to legacy table
        alert_rule = self.create_alert_rule(organization=org)
        self.create_alert_rule_workflow(alert_rule_id=alert_rule.id, workflow=workflow)

        # create data condition group for workflow
        workflow.when_condition_group = self.create_data_condition_group()

        # create data conditions for group or None
        if config["triggers"]:
            # associate each condition with the when condition group
            for trigger in config["triggers"]:
                trigger.condition_group = workflow.when_condition_group
                trigger.save()
        elif config["mock_triggers"]:
            # create mock conditions
            self.create_data_condition(condition_group=workflow.when_condition_group)

        # create action group
        action_filter_group = self.create_data_condition_group()
        self.create_workflow_data_condition_group(
            workflow=workflow, condition_group=action_filter_group
        )

        # create action filters
        if config["action_filters"]:
            # associate each filter with the action_filter_group
            for action_filter in config["action_filters"]:
                action_filter.condition_group = action_filter_group
                action_filter.save()
        elif config["mock_action_filters"]:
            self.create_data_condition(condition_group=action_filter_group)

        # create action
        if config["actions"]:
            # associate each action to the condition group
            for action in config["actions"]:
                action.save()
                self.create_data_condition_group_action(
                    action=action,
                    condition_group=action_filter_group,
                )
        elif config["mock_actions"]:
            action = self.create_action()
            self.create_data_condition_group_action(
                action=action,
                condition_group=action_filter_group,
            )

        workflow.save()
        return workflow

    def setup_initial_state(self) -> None:
        self.orgs = []

        # Isolate each test case to an organization
        for i, workflow_config in enumerate(DUPLICATE_WORKFLOW_CONFIGS):
            org = self.create_organization(name=str(i))

            # Create a random number of duplicate workflows for each org
            for _ in range(randint(2, 5)):
                self.mock_workflow(org, **deepcopy(workflow_config))

            for default_config in DEFAULT_WORKFLOW_CONFIGS:
                self.mock_workflow(org, **deepcopy(default_config))

            self.orgs.append(org)

    def validate_org_workflows_deduped(self, duplicate_workflow_index: int):
        org = Organization.objects.annotate(workflow_count=Count("workflow")).get(
            name=str(duplicate_workflow_index)
        )
        expected_count = (
            len(DEFAULT_WORKFLOW_CONFIGS)
            if DUPLICATE_WORKFLOW_CONFIGS[duplicate_workflow_index] in DEFAULT_WORKFLOW_CONFIGS
            else len(DEFAULT_WORKFLOW_CONFIGS) + 1
        )
        assert org.workflow_count == expected_count

        workflow_ids = org.workflow_set.values_list("id", flat=True)

        # Ensures that we have updated all the connections for workflows that have been deduplicated
        count_connections = DetectorWorkflow.objects.filter(workflow_id__in=workflow_ids).count()
        assert count_connections > expected_count

        count_legacy = AlertRuleWorkflow.objects.filter(workflow_id__in=workflow_ids).count()
        assert count_legacy > expected_count

        # The legacy connections should match the new connections
        assert count_connections == count_legacy

    def test_deduplication__all_mocks(self) -> None:
        index = 0  # mock everything
        self.validate_org_workflows_deduped(index)

    def test_deduplication__no_triggers(self) -> None:
        index = 1  # workflow only has triggers
        self.validate_org_workflows_deduped(index)

    def test_deduplication__no_action_filters(self) -> None:
        index = 2  # workflow has triggers + filters, no actions
        self.validate_org_workflows_deduped(index)

    def test_deduplication__only_action_filters(self) -> None:
        index = 3  # workflow only has filters
        self.validate_org_workflows_deduped(index)

    def test_deduplication__only_actions(self) -> None:
        index = 4  # workflow only has actions
        self.validate_org_workflows_deduped(index)

    def test_deduplication__many_triggers(self) -> None:
        index = 5  # multiple triggers
        self.validate_org_workflows_deduped(index)

    def test_deduplication__many_action_filters(self) -> None:
        index = 6  # multiple action filters
        self.validate_org_workflows_deduped(index)

    def test_deduplication__many_actions(self) -> None:
        index = 7  # multiple actions
        self.validate_org_workflows_deduped(index)

    def test_deduplication__many_triggers_and_filters(self) -> None:
        index = 8  # multiple triggers + action filters
        self.validate_org_workflows_deduped(index)

    def test_deduplication__many_all(self) -> None:
        index = 9  # multiple of all
        self.validate_org_workflows_deduped(index)

    def test_deduplication__empty(self) -> None:
        index = 10  # All workflows are duplicated in this org
        self.validate_org_workflows_deduped(index)

    def test_deduplication__disabled(self) -> None:
        index = 11  # Disabled workflow
        self.validate_org_workflows_deduped(index)
