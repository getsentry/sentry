# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from enum import Enum
from typing import Any

from sentry.hybridcloud.rpc import RpcModel
from sentry.models.projectkey import ProjectKeyStatus


class ProjectKeyRole(Enum):
    store = "store"
    api = "api"

    def as_orm_role(self) -> Any:
        from sentry.models.projectkey import ProjectKey

        if self == ProjectKeyRole.store:
            return ProjectKey.roles.store
        elif self == ProjectKeyRole.api:
            return ProjectKey.roles.api
        else:
            raise ValueError("Unexpected project key role enum")


class RpcProjectKey(RpcModel):
    dsn_public: str = ""
    project_id: int = -1
    status: int = ProjectKeyStatus.INACTIVE

    @property
    def is_active(self) -> bool:
        return self.status == ProjectKeyStatus.ACTIVE
