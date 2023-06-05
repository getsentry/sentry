from __future__ import annotations

from typing import Union

from sentry.models import Project, ProjectOption
from sentry.services.hybrid_cloud.project import ProjectService, RpcProject


class DatabaseBackedProjectService(ProjectService):
    def get_option(self, *, project: RpcProject, key: str) -> Union[str, int, bool]:
        orm_project = Project.objects.get(id=project.id)
        result = ProjectOption.objects.get_value(orm_project, key, None)
        return result  # type: ignore

    def set_option(self, *, project: RpcProject, key: str, value: Union[str, int, bool]) -> None:
        orm_project = Project.objects.get(id=project.id)
        ProjectOption.objects.set_value(orm_project, key, value)
