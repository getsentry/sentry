import logging
from collections.abc import Sequence

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.deletions.defaults.alertrule import AlertRuleDetectorDeletionTask
from sentry.models.rule import Rule
from sentry.workflow_engine.models import Workflow

logger = logging.getLogger(__name__)


class RuleDeletionTask(ModelDeletionTask[Rule]):
    def get_child_relations(self, instance: Rule) -> list[BaseRelation]:
        from sentry.models.grouprulestatus import GroupRuleStatus
        from sentry.models.rule import RuleActivity
        from sentry.workflow_engine.models import AlertRuleDetector, AlertRuleWorkflow

        model_relations: list[BaseRelation] = [
            ModelRelation(GroupRuleStatus, {"rule_id": instance.id}),
            ModelRelation(RuleActivity, {"rule_id": instance.id}),
            ModelRelation(
                AlertRuleDetector,
                {"rule_id": instance.id},
                task=AlertRuleDetectorDeletionTask,
            ),
        ]

        # AlertRuleWorkflow must be deleted before Workflow so the link rows
        # are gone by the time WorkflowDeletionTask runs — otherwise it would
        # cascade back to this Rule and loop infinitely.
        workflow_ids = list(
            AlertRuleWorkflow.objects.filter(rule_id=instance.id).values_list(
                "workflow_id", flat=True
            )
        )
        if workflow_ids:
            model_relations.append(ModelRelation(AlertRuleWorkflow, {"rule_id": instance.id}))
            model_relations.append(ModelRelation(Workflow, {"id__in": workflow_ids}))
        else:
            logger.info(
                "No AlertRuleWorkflow found for rule, skipping", extra={"rule_id": instance.id}
            )

        return model_relations

    def mark_deletion_in_progress(self, instance_list: Sequence[Rule]) -> None:
        from sentry.constants import ObjectStatus

        for instance in instance_list:
            if instance.status != ObjectStatus.PENDING_DELETION:
                instance.update(status=ObjectStatus.PENDING_DELETION)
