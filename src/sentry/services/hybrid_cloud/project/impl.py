from __future__ import annotations

from typing import Dict, List

from sentry.models import Project, ProjectOption
from sentry.services.hybrid_cloud import OptionValue
from sentry.services.hybrid_cloud.project import ProjectService, RpcProject, RpcProjectOptionValue


class DatabaseBackedProjectService(ProjectService):
    def get_options(
        self, *, project: RpcProject, keys: List[str]
    ) -> Dict[str, RpcProjectOptionValue]:
        from sentry import projectoptions

        orm_project = Project.objects.get(id=project.id)
        values = ProjectOption.objects.get_all_values(orm_project)

        result = {}
        for key in keys:
            keyed_result = values.get(key)

            well_known_key = projectoptions.lookup_well_known_key(key)
            well_known_result = (
                None if well_known_key is None else well_known_key.get_default(project)
            )

            result[key] = RpcProjectOptionValue(
                keyed_result=keyed_result, well_known_result=well_known_result
            )

        return result

    def update_option(self, *, project: RpcProject, key: str, value: OptionValue) -> bool:
        orm_project = Project.objects.get(id=project.id)
        return ProjectOption.objects.set_value(orm_project, key, value)  # type: ignore[no-any-return]

    def delete_option(self, *, project: RpcProject, key: str) -> None:
        orm_project = Project.objects.get(id=project.id)
        ProjectOption.objects.unset_value(orm_project, key)
