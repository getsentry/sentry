from typing import int
from sentry.constants import ObjectStatus
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.models.grouprulestatus import GroupRuleStatus
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin
from sentry.workflow_engine.models import AlertRuleDetector, AlertRuleWorkflow
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DeleteRuleTest(HybridCloudTestMixin, BaseWorkflowTest):
    def test_simple(self) -> None:
        project = self.create_project()
        rule = self.create_project_rule(project)
        rule_fire_history = RuleFireHistory.objects.create(
            project=rule.project,
            rule=rule,
            group=self.group,
        )
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
        assert not RuleFireHistory.objects.filter(id=rule_fire_history.id).exists()
        assert not RuleActivity.objects.filter(id=rule_activity.id).exists()
        assert not AlertRuleDetector.objects.filter(rule_id=rule.id).exists()
        assert not AlertRuleWorkflow.objects.filter(rule_id=rule.id).exists()
