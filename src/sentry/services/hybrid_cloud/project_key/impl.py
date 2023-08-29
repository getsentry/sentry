from typing import List, Optional, Tuple

from django.db.models import F

from sentry.constants import ObjectStatus
from sentry.models import ProjectKey, ProjectKeyStatus
from sentry.services.hybrid_cloud.project import RpcProject
from sentry.services.hybrid_cloud.project.serial import serialize_project
from sentry.services.hybrid_cloud.project_key import (
    ProjectKeyRole,
    ProjectKeyService,
    RpcProjectKey,
)
from sentry.services.hybrid_cloud.project_key.serial import serialize_project_key


class DatabaseBackedProjectKeyService(ProjectKeyService):
    def _get_project_key(self, project_id: str, role: ProjectKeyRole) -> Optional[RpcProjectKey]:
        project_keys = ProjectKey.objects.filter(
            project=project_id, roles=F("roles").bitor(role.as_orm_role())
        )

        if project_keys:
            return serialize_project_key(project_keys[0])

        return None

    def get_project_key(
        self, organization_id: int, project_id: str, role: ProjectKeyRole
    ) -> Optional[RpcProjectKey]:
        return self._get_project_key(project_id=project_id, role=role)

    def get_project_key_by_region(
        self, *, region_name: str, project_id: str, role: ProjectKeyRole
    ) -> Optional[RpcProjectKey]:
        return self._get_project_key(project_id=project_id, role=role)

    def get_docsupport_data(
        self, *, region_name: str, organization_ids: List[int], role: ProjectKeyRole
    ) -> List[Tuple[int, RpcProject, RpcProjectKey]]:
        project_keys = ProjectKey.objects.filter(
            status=ProjectKeyStatus.ACTIVE,
            roles=F("roles").bitor(role.as_orm_role()),
            project__organization_id__in=organization_ids,
            project__status=ObjectStatus.ACTIVE,
        ).select_related("project")
        return [
            (
                project_key.project.organization_id,
                serialize_project(project_key.project),
                serialize_project_key(project_key),
            )
            for project_key in project_keys
        ]
