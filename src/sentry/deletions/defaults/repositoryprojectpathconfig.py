from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig


class RepositoryProjectPathConfigDeletionTask(ModelDeletionTask[RepositoryProjectPathConfig]):
    def get_child_relations(self, instance: RepositoryProjectPathConfig) -> list[BaseRelation]:
        from sentry.models.projectcodeowners import ProjectCodeOwners

        return [
            ModelRelation(ProjectCodeOwners, {"repository_project_path_config_id": instance.id}),
        ]
