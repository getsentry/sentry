from collections.abc import Sequence

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.deletions.defaults.alertrule import AlertRuleDetectorDeletionTask
from sentry.models.rule import Rule


class RuleDeletionTask(ModelDeletionTask[Rule]):
    def get_child_relations(self, instance: Rule) -> list[BaseRelation]:
        from sentry.models.grouprulestatus import GroupRuleStatus
        from sentry.models.rule import RuleActivity
        from sentry.workflow_engine.models import AlertRuleDetector, AlertRuleWorkflow

        # Workflows are org-scoped and must not be deleted when a project-scoped
        # Rule is deleted. Workflow cleanup happens via the API (which schedules
        # Workflow deletion explicitly) or OrganizationDeletionTask. We only
        # clean up the link rows (AlertRuleWorkflow, AlertRuleDetector) here.
        return [
            ModelRelation(GroupRuleStatus, {"rule_id": instance.id}),
            ModelRelation(RuleActivity, {"rule_id": instance.id}),
            ModelRelation(
                AlertRuleDetector,
                {"rule_id": instance.id},
                task=AlertRuleDetectorDeletionTask,
            ),
            ModelRelation(AlertRuleWorkflow, {"rule_id": instance.id}),
        ]

    def mark_deletion_in_progress(self, instance_list: Sequence[Rule]) -> None:
        from sentry.constants import ObjectStatus

        for instance in instance_list:
            if instance.status != ObjectStatus.PENDING_DELETION:
                instance.update(status=ObjectStatus.PENDING_DELETION)
