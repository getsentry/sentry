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
class TestFixEmailNotificationNames(TestMigrations):
    migrate_from = "0090_add_detectorgroup_detector_date_index"
    migrate_to = "0091_fix_email_notification_names"
    app = "workflow_engine"

    def setup_initial_state(self):
        self.test_org = self.create_organization(
            name="test-email-fix-org", slug="test-email-fix-org"
        )
        self.test_project = self.create_project(organization=self.test_org)
        self.test_team = self.create_team(organization=self.test_org, name="Backend Team")
        self.test_user = self.create_user(email="test@example.com")

        self.cron_detector = Detector.objects.create(
            project=self.test_project,
            type="monitor_check_in_failure",
            name="Test Cron Detector",
            config={},
        )
        when_dcg1 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        self.workflow_email_team = Workflow.objects.create(
            organization=self.test_org,
            name=f"Notify: Email Team #{self.test_team.id}",
            when_condition_group=when_dcg1,
            enabled=True,
            config={},
        )
        DetectorWorkflow.objects.create(
            detector=self.cron_detector, workflow=self.workflow_email_team
        )
        if_dcg1 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        WorkflowDataConditionGroup.objects.create(
            workflow=self.workflow_email_team,
            condition_group=if_dcg1,
        )
        DataConditionGroupAction.objects.create(
            condition_group=if_dcg1,
            action=Action.objects.create(
                type="email",
                config={
                    "target_type": 2,
                    "target_identifier": str(self.test_team.id),
                    "target_display": None,
                },
            ),
        )
        when_dcg2 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        self.workflow_email_member = Workflow.objects.create(
            organization=self.test_org,
            name=f"Notify: Email Member #{self.test_user.id}",
            when_condition_group=when_dcg2,
            enabled=True,
            config={},
        )
        DetectorWorkflow.objects.create(
            detector=self.cron_detector, workflow=self.workflow_email_member
        )
        if_dcg2 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        WorkflowDataConditionGroup.objects.create(
            workflow=self.workflow_email_member,
            condition_group=if_dcg2,
        )
        DataConditionGroupAction.objects.create(
            condition_group=if_dcg2,
            action=Action.objects.create(
                type="email",
                config={
                    "target_type": 1,
                    "target_identifier": str(self.test_user.id),
                    "target_display": None,
                },
            ),
        )
        when_dcg3 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        self.workflow_mixed = Workflow.objects.create(
            organization=self.test_org,
            name=f"Notify: Slack #alerts, Email Team #{self.test_team.id}",
            when_condition_group=when_dcg3,
            enabled=True,
            config={},
        )
        DetectorWorkflow.objects.create(detector=self.cron_detector, workflow=self.workflow_mixed)
        if_dcg3 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        WorkflowDataConditionGroup.objects.create(
            workflow=self.workflow_mixed,
            condition_group=if_dcg3,
        )
        DataConditionGroupAction.objects.create(
            condition_group=if_dcg3,
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
            condition_group=if_dcg3,
            action=Action.objects.create(
                type="email",
                config={
                    "target_type": 2,
                    "target_identifier": str(self.test_team.id),
                    "target_display": None,
                },
            ),
        )
        when_dcg4 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        self.workflow_no_fix_needed = Workflow.objects.create(
            organization=self.test_org,
            name="Notify: Email Issue Owners",
            when_condition_group=when_dcg4,
            enabled=True,
            config={},
        )
        DetectorWorkflow.objects.create(
            detector=self.cron_detector, workflow=self.workflow_no_fix_needed
        )
        if_dcg4 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        WorkflowDataConditionGroup.objects.create(
            workflow=self.workflow_no_fix_needed,
            condition_group=if_dcg4,
        )
        DataConditionGroupAction.objects.create(
            condition_group=if_dcg4,
            action=Action.objects.create(
                type="email",
                config={
                    "target_type": 4,
                    "target_display": None,
                    "target_identifier": None,
                },
            ),
        )
        when_dcg5 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        self.workflow_no_notify_prefix = Workflow.objects.create(
            organization=self.test_org,
            name=f"Custom Alert: Email Team #{self.test_team.id}",
            when_condition_group=when_dcg5,
            enabled=True,
            config={},
        )
        DetectorWorkflow.objects.create(
            detector=self.cron_detector, workflow=self.workflow_no_notify_prefix
        )
        when_dcg6 = DataConditionGroup.objects.create(
            organization=self.test_org,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        self.workflow_not_cron = Workflow.objects.create(
            organization=self.test_org,
            name=f"Notify: Email Team #{self.test_team.id}",
            when_condition_group=when_dcg6,
            enabled=True,
            config={},
        )

    def test_email_notification_names_fixed(self):
        workflow = Workflow.objects.get(id=self.workflow_email_team.id)
        assert workflow.name == "Notify: Email Backend Team"
        workflow = Workflow.objects.get(id=self.workflow_email_member.id)
        assert workflow.name == "Notify: Email test@example.com"
        workflow = Workflow.objects.get(id=self.workflow_mixed.id)
        assert workflow.name == "Notify: Slack #alerts, Email Backend Team"

        workflow = Workflow.objects.get(id=self.workflow_no_fix_needed.id)
        assert workflow.name == "Notify: Email Issue Owners"
        workflow = Workflow.objects.get(id=self.workflow_no_notify_prefix.id)
        assert workflow.name == f"Custom Alert: Email Team #{self.test_team.id}"
        workflow = Workflow.objects.get(id=self.workflow_not_cron.id)
        assert workflow.name == f"Notify: Email Team #{self.test_team.id}"
