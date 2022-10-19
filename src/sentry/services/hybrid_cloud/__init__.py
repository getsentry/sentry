from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Generic, Mapping, Optional, Type, TypeVar, cast

from django.db.models import F

from sentry.silo import SiloMode


class ProjectKeyRole(Enum):
    store = "store"
    api = "api"

    def as_orm_role(self):
        from sentry.models import ProjectKey

        if self == ProjectKeyRole.store:
            return ProjectKey.roles.store
        else:
            return ProjectKey.roles.api


@dataclass
class ApiProjectKey:
    dsn_public: str = ""


class InterfaceWithLifecycle(ABC):
    @abstractmethod
    def close(self):
        pass


ServiceInterface = TypeVar("ServiceInterface", bound=InterfaceWithLifecycle)


class DelegatedBySiloMode(Generic[ServiceInterface]):
    """
    Lazily instantiates, not thread safe in this design.
    """

    _constructors: Mapping[SiloMode, Type[ServiceInterface]]
    _singletons: Dict[SiloMode, ServiceInterface]

    def __init__(self, mapping: Mapping[SiloMode, Type[ServiceInterface]]):
        self._constructors = mapping
        self._singletons = {}

    def __getattr__(self, item: str):
        cur_mode = SiloMode.get_current_mode()
        if impl := self._singletons.get(cur_mode, None):
            return getattr(impl, item)
        if Con := self._constructors.get(cur_mode, None):
            return getattr(self._singletons.setdefault(cur_mode, Con()), item)

        raise KeyError(f"No implementation found for {cur_mode}.")

    def close(self):
        for impl in self._singletons.values():
            impl.close()
        self._singletons = {}


class ProjectKeyService(InterfaceWithLifecycle):
    @abstractmethod
    def get_project_key(self, project_id: str, role: ProjectKeyRole) -> Optional[ApiProjectKey]:
        pass


class MonolithKeyService(ProjectKeyService):
    def close(self):
        pass

    def get_project_key(self, project_id: str, role: ProjectKeyRole) -> Optional[ApiProjectKey]:
        from sentry.models import ProjectKey

        project_keys = ProjectKey.objects.filter(
            project=project_id, roles=F("roles").bitor(role.as_orm_role())
        )

        if project_keys:
            return ApiProjectKey(dsn_public=project_keys[0].dsn_public)

        return None


class SiloKeyService(ProjectKeyService):
    def close(self):
        pass

    def get_project_key(self, project_id: str, role: ProjectKeyRole) -> Optional[ApiProjectKey]:
        # TODO
        return ApiProjectKey(dsn_public="test-dsn")


def silo_mode_delegation(mapping: Mapping[SiloMode, Type[ServiceInterface]]) -> ServiceInterface:
    return cast(ServiceInterface, DelegatedBySiloMode(mapping))


project_key_service: ProjectKeyService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: MonolithKeyService,
        SiloMode.REGION: SiloKeyService,
        SiloMode.CONTROL: SiloKeyService,
    }
)


def close_all():
    for v in locals().values():
        if isinstance(v, DelegatedBySiloMode):
            v.close()
