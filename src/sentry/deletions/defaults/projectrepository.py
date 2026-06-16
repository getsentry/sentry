from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.integrations.models.repository_project_path_config import (
    RepositoryProjectPathConfig,
)
from sentry.models.projectrepository import ProjectRepository
from sentry.seer.models.project_repository import (
    SeerProjectRepository,
    SeerProjectRepositoryBranchOverride,
)


class ProjectRepositoryDeletionTask(ModelDeletionTask[ProjectRepository]):
    def get_child_relations(self, instance: ProjectRepository) -> list[BaseRelation]:
        return [
            ModelRelation(
                SeerProjectRepositoryBranchOverride,
                {"seer_project_repository__project_repository_id": instance.id},
            ),
            ModelRelation(SeerProjectRepository, {"project_repository_id": instance.id}),
            ModelRelation(RepositoryProjectPathConfig, {"project_repository_id": instance.id}),
        ]
