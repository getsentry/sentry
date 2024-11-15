from collections.abc import Sequence

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.rule import Rule


class RuleDeletionTask(ModelDeletionTask[Rule]):
    def get_child_relations(self, instance: Rule) -> list[BaseRelation]:
        from sentry.models.grouprulestatus import GroupRuleStatus
        from sentry.models.rule import RuleActivity
        from sentry.models.rulefirehistory import RuleFireHistory

        return [
            ModelRelation(GroupRuleStatus, {"rule_id": instance.id}),
            ModelRelation(RuleFireHistory, {"rule_id": instance.id}),
            ModelRelation(RuleActivity, {"rule_id": instance.id}),
        ]

    def mark_deletion_in_progress(self, instance_list: Sequence[Rule]) -> None:
        from sentry.constants import ObjectStatus

        for instance in instance_list:
            if instance.status != ObjectStatus.PENDING_DELETION:
                instance.update(status=ObjectStatus.PENDING_DELETION)
