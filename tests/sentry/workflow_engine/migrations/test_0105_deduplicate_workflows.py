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
    DataConditionGroupAction,
    DetectorWorkflow,
    Workflow,
    WorkflowActionGroupStatus,
)
from sentry.workflow_engine.models.data_condition import Condition


class MockWorkflowConfig(TypedDict, total=False):
    actions: list[Action] | None
    action_filters: list[DataCondition] | None
    enabled: bool | None
    triggers: list[DataCondition] | None
    config: dict | None
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

COUNT_DEFAULT_WORKFLOW_CONFIGS_WITH_ACTIONS = sum(
    1 for config in DEFAULT_WORKFLOW_CONFIGS if config.get("mock_actions") is not False
)


MULTIPLE_TRIGGERS: list[DataCondition] = [
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
]

MULTIPLE_FILTERS: list[DataCondition] = [
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
]

MULTIPLE_ACTIONS: list[Action] = [
    Action(
        type=Action.Type.EMAIL,
        config={
            "target_identifier": "user@sentry.io",
            "target_type": 4,
            "target_display": None,
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
]


# This is list is used to generate the different cases for a workflow to be a duplicate of itself
# Then it's used to reference those mocks, and ensure each case is deduplicated as expected.
DUPLICATE_WORKFLOW_CONFIGS: list[MockWorkflowConfig] = [
    # Include all the default workflows
    {
        # multiple triggers
        "triggers": MULTIPLE_TRIGGERS,
    },
    {
        # multiple action filters
        "action_filters": MULTIPLE_FILTERS,
    },
    {
        # multiple actions
        "actions": MULTIPLE_ACTIONS,
    },
    {
        # triggers + action filters
        "triggers": MULTIPLE_TRIGGERS,
        "action_filters": MULTIPLE_FILTERS,
    },
    {
        # many of all
        "triggers": MULTIPLE_TRIGGERS,
        "action_filters": MULTIPLE_FILTERS,
        "actions": MULTIPLE_ACTIONS,
    },
    {
        # All workflows are duplicated in this org
        "mock_triggers": False,
        "mock_action_filters": False,
        "mock_actions": False,
    },
    *DEFAULT_WORKFLOW_CONFIGS,
]


class TestDeduplicateWorkflows(TestMigrations):
    """
    Each of the following tests are split up and not using parametrize because that doesn't work in these tests.
    Instead, this creates a test case per index, and evaluates them -- more or less re-creating parametrize.
    """

    migrate_from = "0104_action_data_fallthrough_type"
    migrate_to = "0105_deduplicate_workflows"
    app = "workflow_engine"

    def mock_workflow(
        self,
        org: Organization,
        **kwargs: Unpack[MockWorkflowConfig],
    ) -> Workflow:
        config: MockWorkflowConfig = {
            "triggers": None,
            "action_filters": None,
            "actions": None,
            "config": {"frequency": 1440},
            "enabled": True,
            "mock_triggers": True,
            "mock_action_filters": True,
            "mock_actions": True,
            **kwargs,
        }

        # create workflow
        workflow = self.create_workflow(
            organization=org,
            enabled=config["enabled"],
            config=config["config"],
        )

        # connect the workflow to shared detector
        detector = self.create_detector()
        self.create_detector_workflow(detector=detector, workflow=workflow)

        # create a mock connection to legacy table using shared alert rule
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
                WorkflowActionGroupStatus.objects.create(
                    workflow=workflow,
                    action=action,
                    group=self.group,
                )
        elif config["mock_actions"]:
            action = self.create_action()
            self.create_data_condition_group_action(
                action=action,
                condition_group=action_filter_group,
            )
            WorkflowActionGroupStatus.objects.create(
                workflow=workflow,
                action=action,
                group=self.group,
            )

        workflow.save()
        return workflow

    def setup_initial_state(self) -> None:
        # Isolate each test case to an organization
        self.config_replication_count: dict[int, int] = {}

        for i, workflow_config in enumerate(DUPLICATE_WORKFLOW_CONFIGS):
            org = self.create_organization(name=str(i))

            # Create a random number of duplicate workflows for each org
            replication_count = randint(2, 5)
            self.config_replication_count[i] = replication_count

            for _ in range(replication_count):
                self.mock_workflow(org, **deepcopy(workflow_config))

            for default_config in DEFAULT_WORKFLOW_CONFIGS:
                self.mock_workflow(org, **deepcopy(default_config))

    def validate_org_workflows_deduped(self, duplicate_workflow_index: int):
        org = Organization.objects.annotate(workflow_count=Count("workflow")).get(
            name=str(duplicate_workflow_index)
        )

        config = DUPLICATE_WORKFLOW_CONFIGS[duplicate_workflow_index]
        is_default_config = config in DEFAULT_WORKFLOW_CONFIGS

        expected_count = (
            len(DEFAULT_WORKFLOW_CONFIGS)
            if is_default_config
            else len(DEFAULT_WORKFLOW_CONFIGS) + 1
        )

        assert org.workflow_count == expected_count

        # Ensures that we have updated all the connections for workflows that have been deduplicated
        workflow_ids = org.workflow_set.values_list("id", flat=True)
        count_connections = DetectorWorkflow.objects.filter(workflow_id__in=workflow_ids).count()
        assert count_connections > expected_count

        count_legacy = AlertRuleWorkflow.objects.filter(workflow_id__in=workflow_ids).count()
        assert count_legacy > expected_count

        # The legacy connections should match the new connections
        assert count_connections == count_legacy

        # Validate WorkflowActionGroupStatus records after de-duplication
        wags_count = WorkflowActionGroupStatus.objects.filter(workflow_id__in=workflow_ids).count()

        config_action_count = len(config.get("actions", []) or [])
        if (
            not is_default_config
            and config_action_count == 0
            and config.get("mock_actions") is not False
        ):
            config_action_count = 1

        assert wags_count == config_action_count + COUNT_DEFAULT_WORKFLOW_CONFIGS_WITH_ACTIONS

        # Verify no orphaned Action objects exist - all remaining actions should be connected to existing workflows
        remaining_actions = Action.objects.filter(
            dataconditiongroupaction__condition_group__workflowdataconditiongroup__workflow_id__in=workflow_ids
        )
        all_actions_in_org = Action.objects.filter(
            dataconditiongroupaction__condition_group__workflowdataconditiongroup__workflow__organization=org
        )
        assert (
            remaining_actions.count() == all_actions_in_org.count()
        ), f"Found orphaned Action objects in org {org.name}"

        # Verify no orphaned DataConditionGroupAction objects exist
        remaining_dcga = DataConditionGroupAction.objects.filter(
            condition_group__workflowdataconditiongroup__workflow_id__in=workflow_ids
        )
        all_dcga_in_org = DataConditionGroupAction.objects.filter(
            condition_group__workflowdataconditiongroup__workflow__organization=org
        )
        assert (
            remaining_dcga.count() == all_dcga_in_org.count()
        ), f"Found orphaned DataConditionGroupAction objects in org {org.name}"

    def test_deduplication(self) -> None:
        for i, config in enumerate(DUPLICATE_WORKFLOW_CONFIGS):
            try:
                self.validate_org_workflows_deduped(i)
            except AssertionError as e:
                e.args = (f"Configuration {i} failed. {str(e)}",)
                raise
