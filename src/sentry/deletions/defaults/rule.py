from ..base import ModelDeletionTask, ModelRelation


class RuleDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models.grouprulestatus import GroupRuleStatus
        from sentry.models.rule import RuleActivity
        from sentry.models.rulefirehistory import RuleFireHistory

        return [
            ModelRelation(GroupRuleStatus, {"rule_id": instance.id}),
            ModelRelation(RuleFireHistory, {"rule_id": instance.id}),
            ModelRelation(RuleActivity, {"rule_id": instance.id}),
        ]

    def mark_deletion_in_progress(self, instance_list):
        from sentry.constants import ObjectStatus

        for instance in instance_list:
            if instance.status != ObjectStatus.PENDING_DELETION:
                instance.update(status=ObjectStatus.PENDING_DELETION)
