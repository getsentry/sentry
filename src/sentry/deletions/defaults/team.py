from ..base import ModelDeletionTask, ModelRelation


class TeamDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models import ProjectTeam

        return [ModelRelation(ProjectTeam, {"team_id": instance.id})]

    def mark_deletion_in_progress(self, instance_list):
        from sentry.models import TeamStatus

        for instance in instance_list:
            if instance.status != TeamStatus.DELETION_IN_PROGRESS:
                instance.update(status=TeamStatus.DELETION_IN_PROGRESS)

    def delete_instance(self, instance):
        from sentry.incidents.models import AlertRule
        from sentry.models import Rule

        AlertRule.objects.filter(owner_id=instance.actor_id).update(owner=None)
        Rule.objects.filter(owner_id=instance.actor_id).update(owner=None)

        super().delete_instance(instance)
