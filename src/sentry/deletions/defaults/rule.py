from ..base import ModelDeletionTask, ModelRelation


class RuleDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import GroupRuleStatus, RuleActivity, RuleFireHistory

        return [
            ModelRelation(GroupRuleStatus, {"rule": instance}),
            ModelRelation(RuleFireHistory, {"rule": instance}),
            ModelRelation(RuleActivity, {"rule": instance}),
        ]

    def mark_deletion_in_progress(self, instance_list):
        from sentry.models import RuleStatus

        for instance in instance_list:
            if instance.status != RuleStatus.PENDING_DELETION:
                instance.update(status=RuleStatus.PENDING_DELETION)
