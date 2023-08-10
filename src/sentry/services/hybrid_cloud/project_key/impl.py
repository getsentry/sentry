from typing import List, Optional

from django.db.models import F

from sentry.services.hybrid_cloud.project_key import (
    ProjectKeyRole,
    ProjectKeyService,
    RpcProjectKey,
)
from sentry.services.hybrid_cloud.project_key.serial import serialize_project_key


class DatabaseBackedProjectKeyService(ProjectKeyService):
    def _get_project_key(self, project_id: str, role: ProjectKeyRole) -> Optional[RpcProjectKey]:
        from sentry.models import ProjectKey

        project_keys = ProjectKey.objects.filter(
            project=project_id, roles=F("roles").bitor(role.as_orm_role())
        )

        if project_keys:
            return RpcProjectKey(dsn_public=project_keys[0].dsn_public)

        return None

    def get_project_key(
        self, organization_id: int, project_id: str, role: ProjectKeyRole
    ) -> Optional[RpcProjectKey]:
        return self._get_project_key(project_id=project_id, role=role)

    def get_project_key_by_region(
        self, *, region_name: str, project_id: str, role: ProjectKeyRole
    ) -> Optional[RpcProjectKey]:
        return self._get_project_key(project_id=project_id, role=role)

    def get_project_key_for_org(
        self, *, organization_id: int, status: Optional[int]
    ) -> List[RpcProjectKey]:
        from sentry.models import ProjectKey

        project_keys = ProjectKey.objects.filter(
            status=status,
            roles=F("roles").bitor(ProjectKey.roles.store),
            project__organization_id=organization_id,
        )
        return [serialize_project_key(project_key) for project_key in project_keys]
