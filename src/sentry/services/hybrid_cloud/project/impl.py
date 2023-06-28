from __future__ import annotations

from typing import List, Optional

from sentry.api.serializers import ProjectSerializer
from sentry.models import Project, ProjectOption
from sentry.services.hybrid_cloud import OptionValue
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import OpaqueSerializedResponse
from sentry.services.hybrid_cloud.project import (
    ProjectFilterArgs,
    ProjectService,
    RpcProject,
    RpcProjectOptionValue,
)
from sentry.services.hybrid_cloud.project.serial import serialize_project
from sentry.services.hybrid_cloud.user import RpcUser


class DatabaseBackedProjectService(ProjectService):
    def get_by_id(self, *, organization_id: int, id: int) -> RpcProject | None:
        try:
            project = Project.objects.get_from_cache(id=id, organization=organization_id)
        except ValueError:
            project = Project.objects.filter(id=id, organization=organization_id).first()
        except Project.DoesNotExist:
            return None
        if project:
            return serialize_project(project)
        return None

    def get_option(self, *, project: RpcProject, key: str) -> RpcProjectOptionValue:
        from sentry import projectoptions

        orm_project = Project.objects.get_from_cache(id=project.id)
        result = ProjectOption.objects.get_all_values(orm_project)
        keyed_result = result.get(key)

        well_known_key = projectoptions.lookup_well_known_key(key)
        well_known_result = None if well_known_key is None else well_known_key.get_default(project)

        return RpcProjectOptionValue(keyed_result=keyed_result, well_known_result=well_known_result)

    def update_option(self, *, project: RpcProject, key: str, value: OptionValue) -> bool:
        orm_project = Project.objects.get(id=project.id)
        return ProjectOption.objects.set_value(orm_project, key, value)

    def delete_option(self, *, project: RpcProject, key: str) -> None:
        orm_project = Project.objects.get(id=project.id)
        ProjectOption.objects.unset_value(orm_project, key)

    def serialize_many(
        self,
        *,
        organization_id: int,
        filter: ProjectFilterArgs,
        as_user: Optional[RpcUser] = None,
        auth_context: Optional[AuthenticationContext] = None,
    ) -> List[OpaqueSerializedResponse]:
        from sentry.api.serializers import serialize

        if as_user is None and auth_context:
            as_user = auth_context.user

        return serialize(
            list(
                Project.objects.filter(
                    id__in=filter.get("project_ids", []), organization_id=organization_id
                )
            ),
            user=as_user,
            serializer=ProjectSerializer(),
        )
