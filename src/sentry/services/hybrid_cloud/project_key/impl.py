from typing import List, Optional

from django.db.models import F

from sentry.models.projectkey import ProjectKey, ProjectKeyStatus
from sentry.services.hybrid_cloud.project_key import (
    ProjectKeyRole,
    ProjectKeyService,
    RpcProjectKey,
)
from sentry.services.hybrid_cloud.project_key.serial import serialize_project_key


class DatabaseBackedProjectKeyService(ProjectKeyService):
    def _get_project_key(self, project_id: str, role: ProjectKeyRole) -> Optional[RpcProjectKey]:
        from sentry.models.projectkey import ProjectKey

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

    def get_default_project_key(
        self, *, organization_id: int, project_id: str
    ) -> Optional[RpcProjectKey]:
        from sentry.models.project import Project
        from sentry.models.projectkey import ProjectKey

        try:
            project = Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            return None

        key = ProjectKey.get_default(project)
        return serialize_project_key(key) if key else None

    def get_project_key_by_region(
        self, *, region_name: str, project_id: str, role: ProjectKeyRole
    ) -> Optional[RpcProjectKey]:
        return self._get_project_key(project_id=project_id, role=role)

    def get_project_keys_by_region(
        self,
        *,
        region_name: str,
        project_ids: List[str],
        role: ProjectKeyRole,
    ) -> List[RpcProjectKey]:
        # TODO: This query is unbounded and will need to be addressed in the future.
        project_keys = ProjectKey.objects.filter(
            project__in=project_ids,
            roles=F("roles").bitor(role.as_orm_role()),
            status=ProjectKeyStatus.ACTIVE,
        ).order_by("-date_added")
        return [serialize_project_key(pk) for pk in project_keys]
