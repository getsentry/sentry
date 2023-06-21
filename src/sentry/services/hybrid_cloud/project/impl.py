from __future__ import annotations

from typing import List

from sentry.constants import ObjectStatus
from sentry.models import Project, ProjectOption
from sentry.services.hybrid_cloud import OptionValue
from sentry.services.hybrid_cloud.project import ProjectService, RpcProject, RpcProjectOptionValue
from sentry.services.hybrid_cloud.project.serial import serialize_project


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

    def get_projects(self, *, organization_id: int, only_active: bool = False) -> List[RpcProject]:
        query = Project.objects.filter(organization_id=organization_id)
        if only_active:
            query = query.filter(status=ObjectStatus.ACTIVE)
        return [serialize_project(p) for p in query]

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
