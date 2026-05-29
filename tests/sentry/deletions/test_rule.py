from sentry.constants import ObjectStatus
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.models.grouprulestatus import GroupRuleStatus
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.workflow_engine.models import AlertRuleDetector, AlertRuleWorkflow, Detector, Workflow
from sentry.workflow_engine.models.detector_workflow import DetectorWorkflow
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DeleteRuleTest(HybridCloudTestMixin, BaseWorkflowTest):
    def test_both_rule_and_workflow_scheduled_rule_first(self) -> None:
        project = self.create_project()
        rule = self.create_project_rule(project)
        workflow = self.create_workflow()
        self.create_alert_rule_workflow(rule_id=rule.id, workflow=workflow)

        self.ScheduledDeletion.schedule(instance=rule, days=0)
        self.ScheduledDeletion.schedule(instance=workflow, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Rule.objects.filter(id=rule.id).exists()
        assert not Workflow.objects_for_deletion.filter(id=workflow.id).exists()
        assert not AlertRuleWorkflow.objects.filter(rule_id=rule.id).exists()

    def test_both_rule_and_workflow_scheduled_workflow_first(self) -> None:
        project = self.create_project()
        rule = self.create_project_rule(project)
        workflow = self.create_workflow()
        self.create_alert_rule_workflow(rule_id=rule.id, workflow=workflow)

        self.ScheduledDeletion.schedule(instance=workflow, days=0)
        self.ScheduledDeletion.schedule(instance=rule, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Rule.objects.filter(id=rule.id).exists()
        assert not Workflow.objects_for_deletion.filter(id=workflow.id).exists()
        assert not AlertRuleWorkflow.objects.filter(rule_id=rule.id).exists()

    def test_simple(self) -> None:
        project = self.create_project()
        rule = self.create_project_rule(project)
        group_rule_status = GroupRuleStatus.objects.create(
            rule=rule, group=self.group, project=rule.project
        )
        rule_activity = RuleActivity.objects.create(rule=rule, type=RuleActivityType.CREATED.value)

        detector = self.create_detector()
        workflow = self.create_workflow()
        AlertRuleDetector.objects.create(rule_id=rule.id, detector=detector)
        AlertRuleWorkflow.objects.create(rule_id=rule.id, workflow=workflow)

        self.ScheduledDeletion.schedule(instance=rule, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Rule.objects.filter(
            id=rule.id, project=project, status=ObjectStatus.PENDING_DELETION
        ).exists()
        assert not GroupRuleStatus.objects.filter(id=group_rule_status.id).exists()
        assert not RuleActivity.objects.filter(id=rule_activity.id).exists()
        # Link rows are cleaned up
        assert not AlertRuleDetector.objects.filter(rule_id=rule.id).exists()
        assert not AlertRuleWorkflow.objects.filter(rule_id=rule.id).exists()
        # Workflow and Detector survive — they are now the primary entities.
        assert Workflow.objects.filter(id=workflow.id).exists()
        assert Detector.objects.filter(id=detector.id).exists()

    def test_deleting_rule_does_not_delete_workflow_with_detector_links(self) -> None:
        project = self.create_project()
        rule = self.create_project_rule(project)
        detector = self.create_detector()
        workflow = self.create_workflow()
        AlertRuleWorkflow.objects.create(rule_id=rule.id, workflow=workflow)
        DetectorWorkflow.objects.create(detector=detector, workflow=workflow)

        self.ScheduledDeletion.schedule(instance=rule, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert not Rule.objects.filter(id=rule.id).exists()
        assert not AlertRuleWorkflow.objects.filter(rule_id=rule.id).exists()
        # Workflow stays alive — it's still connected to a Detector.
        assert Workflow.objects.filter(id=workflow.id).exists()
        assert DetectorWorkflow.objects.filter(detector=detector, workflow=workflow).exists()
