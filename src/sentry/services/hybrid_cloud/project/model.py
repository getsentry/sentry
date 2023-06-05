# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.
from pydantic.fields import Field

from sentry.constants import ObjectStatus
from sentry.services.hybrid_cloud import RpcModel


def _project_status_visible() -> int:
    return int(ObjectStatus.ACTIVE)


class RpcProject(RpcModel):
    id: int = -1
    slug: str = ""
    name: str = ""
    organization_id: int = -1
    status: int = Field(default_factory=_project_status_visible)
