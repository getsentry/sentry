from abc import abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.silo import SiloMode


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


@dataclass
class ApiProjectKey:
    dsn_public: str = ""


class ProjectKeyService(InterfaceWithLifecycle):
    @abstractmethod
    def get_project_key(self, project_id: str, role: ProjectKeyRole) -> Optional[ApiProjectKey]:
        pass


def impl_with_db() -> ProjectKeyService:
    from sentry.services.hybrid_cloud.project_key.impl import DatabaseBackedProjectKeyService

    return DatabaseBackedProjectKeyService()


project_key_service: ProjectKeyService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.REGION: impl_with_db,
        SiloMode.CONTROL: stubbed(impl_with_db, SiloMode.REGION),
    }
)
