from __future__ import annotations

from typing import Optional, Tuple

from sentry.models import Project, ProjectOption
from sentry.services.hybrid_cloud import OptionValue
from sentry.services.hybrid_cloud.project import ProjectService, RpcProject


class DatabaseBackedProjectService(ProjectService):
    def get_option(
        self, *, project: RpcProject, key: str
    ) -> Tuple[Optional[OptionValue], Optional[OptionValue]]:
        from sentry import projectoptions

        orm_project = Project.objects.get(id=project.id)
        result = ProjectOption.objects.get_all_values(orm_project)
        keyed_result = result.get(key)

        well_known_key = projectoptions.lookup_well_known_key(key)
        well_known_result = None if well_known_key is None else well_known_key.get_default(project)

        return keyed_result, well_known_result

    def update_option(self, *, project: RpcProject, key: str, value: OptionValue) -> bool:
        orm_project = Project.objects.get(id=project.id)
        return ProjectOption.objects.set_value(orm_project, key, value)  # type: ignore[no-any-return]

    def delete_option(self, *, project: RpcProject, key: str) -> None:
        orm_project = Project.objects.get(id=project.id)
        ProjectOption.objects.unset_value(orm_project, key)
