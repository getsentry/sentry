from django.db.models import F

from sentry.models.projectkey import ProjectKey, UseCase
from sentry.projects.services.project_key import ProjectKeyRole, ProjectKeyService, RpcProjectKey
from sentry.projects.services.project_key.serial import serialize_project_key


class DatabaseBackedProjectKeyService(ProjectKeyService):
    def _get_project_key(self, project_id: int, role: ProjectKeyRole) -> RpcProjectKey | None:
        project_keys = ProjectKey.objects.filter(
            use_case=UseCase.USER.value,
            project=project_id,
            roles=F("roles").bitor(role.as_orm_role()),
        )

        if project_keys:
            return serialize_project_key(project_keys[0])

        return None

    def get_project_key(
        self, organization_id: int, project_id: int, role: ProjectKeyRole
    ) -> RpcProjectKey | None:
        return self._get_project_key(project_id=project_id, role=role)

    def get_default_project_key(
        self, *, organization_id: int, project_id: int
    ) -> RpcProjectKey | None:
        from sentry.models.project import Project

        try:
            project = Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            return None

        key = ProjectKey.get_default(project)
        return serialize_project_key(key) if key else None

    def get_project_key_by_cell(
        self, *, cell_name: str, project_id: int, role: ProjectKeyRole
    ) -> RpcProjectKey | None:
        return self._get_project_key(project_id=project_id, role=role)
