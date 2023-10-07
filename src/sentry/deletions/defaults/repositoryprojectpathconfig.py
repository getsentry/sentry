from ..base import ModelDeletionTask, ModelRelation


class RepositoryProjectPathConfigDeletionTask(ModelDeletionTask):
    def get_child_relations(self, instance):
        from sentry.models.projectcodeowners import ProjectCodeOwners

        return [
            ModelRelation(ProjectCodeOwners, {"repository_project_path_config_id": instance.id}),
        ]
