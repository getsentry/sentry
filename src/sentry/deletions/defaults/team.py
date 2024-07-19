from ..base import ModelDeletionTask, ModelRelation


class TeamDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models.projectteam import ProjectTeam

        return [
            ModelRelation(ProjectTeam, {"team_id": instance.id}),
        ]

    def mark_deletion_in_progress(self, instance_list):
        from sentry.models.team import TeamStatus

        for instance in instance_list:
            if instance.status != TeamStatus.DELETION_IN_PROGRESS:
                instance.update(status=TeamStatus.DELETION_IN_PROGRESS)

    def delete_instance(self, instance):
        from sentry.incidents.models.alert_rule import AlertRule
        from sentry.models.rule import Rule
        from sentry.monitors.models import Monitor

        AlertRule.objects.filter(team_id=instance.id).update(team_id=None)
        Rule.objects.filter(owner_team_id=instance.id).update(owner_team_id=None)
        Monitor.objects.filter(owner_team_id=instance.id).update(owner_team_id=None)
        super().delete_instance(instance)
