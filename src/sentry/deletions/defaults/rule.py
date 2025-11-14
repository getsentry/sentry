from typing import int
import logging
from collections.abc import Sequence

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.rule import Rule
from sentry.workflow_engine.models import Workflow

logger = logging.getLogger(__name__)


class RuleDeletionTask(ModelDeletionTask[Rule]):
    def get_child_relations(self, instance: Rule) -> list[BaseRelation]:
        from sentry.models.grouprulestatus import GroupRuleStatus
        from sentry.models.rule import RuleActivity
        from sentry.models.rulefirehistory import RuleFireHistory
        from sentry.workflow_engine.models import AlertRuleDetector, AlertRuleWorkflow

        model_relations: list[BaseRelation] = [
            ModelRelation(GroupRuleStatus, {"rule_id": instance.id}),
            ModelRelation(RuleFireHistory, {"rule_id": instance.id}),
            ModelRelation(RuleActivity, {"rule_id": instance.id}),
            ModelRelation(AlertRuleDetector, {"rule_id": instance.id}),
        ]

        alert_rule_workflow = AlertRuleWorkflow.objects.filter(rule_id=instance.id).first()
        if alert_rule_workflow:
            model_relations.append(ModelRelation(Workflow, {"id": alert_rule_workflow.workflow_id}))
        else:
            logger.error(
                "No AlertRuleWorkflow found for rule, skipping", extra={"rule_id": instance.id}
            )
        model_relations.append(ModelRelation(AlertRuleWorkflow, {"rule_id": instance.id}))

        return model_relations

    def mark_deletion_in_progress(self, instance_list: Sequence[Rule]) -> None:
        from sentry.constants import ObjectStatus

        for instance in instance_list:
            if instance.status != ObjectStatus.PENDING_DELETION:
                instance.update(status=ObjectStatus.PENDING_DELETION)
