# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import List, Optional

from pydantic.fields import Field
from typing_extensions import TypedDict

from sentry.constants import ObjectStatus
from sentry.db.models import ValidateFunction, Value
from sentry.models.options.option import HasOption
from sentry.services.hybrid_cloud import OptionValue, RpcModel


def _project_status_visible() -> int:
    return int(ObjectStatus.ACTIVE)


class ProjectFilterArgs(TypedDict, total=False):
    project_ids: List[int]


class RpcProject(RpcModel, HasOption):
    id: int = -1
    slug: str = ""
    name: str = ""
    organization_id: int = -1
    status: int = Field(default_factory=_project_status_visible)
    platform: Optional[str] = None

    def get_option(
        self, key: str, default: Optional[Value] = None, validate: Optional[ValidateFunction] = None
    ) -> Value:
        from sentry.services.hybrid_cloud.project import project_service

        keyed_result, well_known_result = project_service.get_option(project=self, key=key)
        if validate is None or validate(keyed_result):
            return keyed_result
        if default is not None:
            return default
        return well_known_result

    def update_option(self, key: str, value: Value) -> bool:
        from sentry.services.hybrid_cloud.project import project_service

        return project_service.update_option(self, key, value)

    def delete_option(self, key: str) -> None:
        from sentry.services.hybrid_cloud.project import project_service

        project_service.delete_option(self, key)


class RpcProjectOptionValue(RpcModel):
    keyed_result: OptionValue
    well_known_result: OptionValue
