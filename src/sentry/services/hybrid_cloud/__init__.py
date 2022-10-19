import contextlib
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
    _constructors: Mapping[SiloMode, Type[ServiceInterface]]
    _singleton: Dict[SiloMode, ServiceInterface]

    def __init__(self, mapping: Mapping[SiloMode, Type[ServiceInterface]]):
        self._constructors = mapping
        self._singleton = {}

    @contextlib.contextmanager
    def with_replacement(self, service: Optional[ServiceInterface], silo_mode: SiloMode):
        prev = self._singleton
        self.close()

        if service:
            self._singleton[silo_mode] = service
            yield
        else:
            yield
        self.close()
        self._singleton = prev

    def __getattr__(self, item: str):
        cur_mode = SiloMode.get_current_mode()
        if impl := self._singleton.get(cur_mode, None):
            return getattr(impl, item)
        if Con := self._constructors.get(cur_mode, None):
            self.close()
            return getattr(self._singleton.setdefault(cur_mode, Con()), item)

        raise KeyError(f"No implementation found for {cur_mode}.")

    def close(self):
        for impl in self._singleton.values():
            impl.close()
        self._singleton = {}


class ProjectKeyService(InterfaceWithLifecycle):
    @abstractmethod
    def get_project_key(self, project_id: str, role: ProjectKeyRole) -> Optional[ApiProjectKey]:
        pass


class DatabaseBackedProjectKeyService(ProjectKeyService):
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


class StubProjectKeyService(ProjectKeyService):
    def close(self):
        pass

    def get_project_key(self, project_id: str, role: ProjectKeyRole) -> Optional[ApiProjectKey]:
        return ApiProjectKey(dsn_public="test-dsn")


def silo_mode_delegation(mapping: Mapping[SiloMode, Type[ServiceInterface]]) -> ServiceInterface:
    return cast(InterfaceWithLifecycle, DelegatedBySiloMode(mapping))


@contextlib.contextmanager
def service_stubbed(
    service: InterfaceWithLifecycle,
    stub: Optional[InterfaceWithLifecycle],
    silo_mode: Optional[SiloMode] = None,
):
    if silo_mode is None:
        silo_mode = SiloMode.get_current_mode()

    if isinstance(service, DelegatedBySiloMode):
        with service.with_replacement(stub, silo_mode):
            yield
    else:
        raise ValueError("Service needs to be a DelegatedBySilMode object, but it was not!")


@contextlib.contextmanager
def service_unstubbed(service: InterfaceWithLifecycle, silo_mode: Optional[SiloMode] = None):
    if silo_mode is None:
        silo_mode = SiloMode.get_current_mode()

    if isinstance(service, DelegatedBySiloMode):
        with service.with_replacement(None, silo_mode):
            yield
    else:
        raise ValueError("Service needs to be a DelegatedBySilMode object, but it was not!")


project_key_service: ProjectKeyService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: DatabaseBackedProjectKeyService,
        SiloMode.REGION: DatabaseBackedProjectKeyService,
        SiloMode.CONTROL: StubProjectKeyService,  # TODO: Real Service
    }
)


def close_all():
    for v in locals().values():
        if isinstance(v, DelegatedBySiloMode):
            v.close()
