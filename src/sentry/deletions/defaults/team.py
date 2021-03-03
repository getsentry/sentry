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
