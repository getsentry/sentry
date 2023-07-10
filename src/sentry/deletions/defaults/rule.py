from ..base import ModelDeletionTask, ModelRelation


class RuleDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import GroupRuleStatus, RuleActivity
        from sentry.models.rulefirehistory import RuleFireHistory

        return [
            ModelRelation(GroupRuleStatus, {"rule_id": instance.id}),
            ModelRelation(RuleFireHistory, {"rule_id": instance.id}),
            ModelRelation(RuleActivity, {"rule_id": instance.id}),
        ]

    def mark_deletion_in_progress(self, instance_list):
        from sentry.models import RuleStatus

        for instance in instance_list:
            if instance.status != RuleStatus.PENDING_DELETION:
                instance.update(status=RuleStatus.PENDING_DELETION)
