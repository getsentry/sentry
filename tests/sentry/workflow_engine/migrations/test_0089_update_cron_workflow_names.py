import pytest

from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import (
    Action,
    DataConditionGroup,
    DataConditionGroupAction,
    Detector,
    DetectorWorkflow,
    Workflow,
    WorkflowDataConditionGroup,
)


@pytest.mark.skip
class TestUpdateCronWorkflowNames(TestMigrations):
    migrate_from = "0088_remove_monitor_slug_conditions"
    migrate_to = "0089_update_cron_workflow_names"
    app = "workflow_engine"

    def setup_initial_state(self):
        self.test_org = self.create_organization(
            name="test-cron-migration-org", slug="test-cron-migration-org"
        )
        self.test_project = self.create_project(organization=self.test_org)

        self.cron_detector1 = Detector.objects.create(
            project=self.test_project,
            type="monitor_check_in_failure",
            name="Test Cron Detector 1",
            config={},
        )
        self.cron_detector2 = Detector.objects.create(
            project=self.test_project,
            type="monitor_check_in_failure",
            name="Test Cron Detector 2",
            config={},
        )
        when_dcg1 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        self.workflow_three_actions = Workflow.objects.create(
            organization=self.test_org,
            name="Monitor Alert: my-monitor",
            when_condition_group=when_dcg1,
            enabled=True,
            config={},
        )
        DetectorWorkflow.objects.create(
            detector=self.cron_detector1, workflow=self.workflow_three_actions
        )
        if_dcg1 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        WorkflowDataConditionGroup.objects.create(
            workflow=self.workflow_three_actions,
            condition_group=if_dcg1,
        )
        DataConditionGroupAction.objects.create(
            condition_group=if_dcg1,
            action=Action.objects.create(
                type="slack",
                config={
                    "target_display": "#alerts",
                    "target_identifier": "C1234567",
                    "target_type": 0,
                },
            ),
        )
        DataConditionGroupAction.objects.create(
            condition_group=if_dcg1,
            action=Action.objects.create(
                type="email",
                config={
                    "target_type": 4,
                    "target_display": None,
                    "target_identifier": None,
                },
                data={"fallthroughType": "ActiveMembers"},
            ),
        )
        DataConditionGroupAction.objects.create(
            condition_group=if_dcg1,
            action=Action.objects.create(
                type="sentry_app",
                config={
                    "target_display": "My Custom App",
                    "target_identifier": "123",
                    "target_type": 3,
                    "sentry_app_identifier": "sentry_app_id",
                },
            ),
        )
        when_dcg2 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        self.workflow_many_actions = Workflow.objects.create(
            organization=self.test_org,
            name="Monitor Alert: too-many",
            when_condition_group=when_dcg2,
            enabled=True,
            config={},
        )
        DetectorWorkflow.objects.create(
            detector=self.cron_detector2, workflow=self.workflow_many_actions
        )
        if_dcg2 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        WorkflowDataConditionGroup.objects.create(
            workflow=self.workflow_many_actions,
            condition_group=if_dcg2,
        )
        for i in range(5):
            if i == 0:
                action = Action.objects.create(
                    type="webhook",
                    config={},
                )
            else:
                action = Action.objects.create(
                    type="slack",
                    config={
                        "target_display": f"#channel-{i}",
                        "target_identifier": f"C{1234567890 + i}",
                        "target_type": 0,
                    },
                )
            DataConditionGroupAction.objects.create(
                condition_group=if_dcg2,
                action=action,
            )
        when_dcg3 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        self.workflow_no_actions = Workflow.objects.create(
            organization=self.test_org,
            name="Monitor Alert: no-actions",
            when_condition_group=when_dcg3,
            enabled=True,
            config={},
        )
        DetectorWorkflow.objects.create(
            detector=self.cron_detector1, workflow=self.workflow_no_actions
        )
        when_dcg4 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        self.workflow_no_prefix = Workflow.objects.create(
            organization=self.test_org,
            name="Custom Cron Alert",
            when_condition_group=when_dcg4,
            enabled=True,
            config={},
        )
        DetectorWorkflow.objects.create(
            detector=self.cron_detector1, workflow=self.workflow_no_prefix
        )
        when_dcg5 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        self.non_cron_workflow = Workflow.objects.create(
            organization=self.test_org,
            name="Monitor Alert: not-a-cron",
            when_condition_group=when_dcg5,
            enabled=True,
            config={},
        )
        when_dcg6 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        self.workflow_other_actions = Workflow.objects.create(
            organization=self.test_org,
            name="Monitor Alert: other-actions",
            when_condition_group=when_dcg6,
            enabled=True,
            config={},
        )
        DetectorWorkflow.objects.create(
            detector=self.cron_detector1, workflow=self.workflow_other_actions
        )
        if_dcg6 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        WorkflowDataConditionGroup.objects.create(
            workflow=self.workflow_other_actions,
            condition_group=if_dcg6,
        )
        DataConditionGroupAction.objects.create(
            condition_group=if_dcg6,
            action=Action.objects.create(
                type="pagerduty",
                config={
                    "target_identifier": "PDSERVICE1",
                    "target_display": "Critical Service",
                    "target_type": 0,
                },
            ),
        )
        DataConditionGroupAction.objects.create(
            condition_group=if_dcg6,
            action=Action.objects.create(
                type="vsts",
                config={
                    "target_identifier": None,
                    "target_display": None,
                    "target_type": 0,
                },
            ),
        )
        DataConditionGroupAction.objects.create(
            condition_group=if_dcg6,
            action=Action.objects.create(
                type="discord",
                config={
                    "target_display": "#alerts",
                    "target_identifier": "123456789",
                    "target_type": 0,
                },
            ),
        )

    def test_all_workflow_name_scenarios(self):
        workflow = Workflow.objects.get(id=self.workflow_three_actions.id)
        assert workflow.name == "Notify: Slack #alerts, Email Issue Owners, Notify My Custom App"
        workflow = Workflow.objects.get(id=self.workflow_many_actions.id)
        assert workflow.name == "Notify: Webhook, Slack #channel-1, Slack #channel-2...(+2)"
        workflow = Workflow.objects.get(id=self.workflow_no_actions.id)
        assert workflow.name == "Monitor Alert: no-actions"
        workflow = Workflow.objects.get(id=self.workflow_no_prefix.id)
        assert workflow.name == "Custom Cron Alert"
        workflow = Workflow.objects.get(id=self.non_cron_workflow.id)
        assert workflow.name == "Monitor Alert: not-a-cron"
        workflow = Workflow.objects.get(id=self.workflow_other_actions.id)
        assert workflow.name == "Notify: PagerDuty, Azure DevOps, Discord #alerts"
