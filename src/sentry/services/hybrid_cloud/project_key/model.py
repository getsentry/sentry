# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from enum import Enum
from typing import Any

from sentry.services.hybrid_cloud import RpcModel


class ProjectKeyRole(Enum):
    store = "store"
    api = "api"

    def as_orm_role(self) -> Any:
        from sentry.models import ProjectKey

        if self == ProjectKeyRole.store:
            return ProjectKey.roles.store
        elif self == ProjectKeyRole.api:
            return ProjectKey.roles.api
        else:
            raise ValueError("Unexpected project key role enum")


class RpcProjectKey(RpcModel):
    dsn_public: str = ""
