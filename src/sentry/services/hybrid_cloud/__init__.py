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
    }
)


def close_all():
    for v in locals().values():
        if isinstance(v, DelegatedBySiloMode):
            v.close()


# def with_service(movie)

# 1.  It needs to be able to swap implementation in tests.
#      It can have settings that back it, but the backend has to be dynamic.
# 2.  esp kafka producers, but maybe other things.
#     lifecycle hooks?
#     I upgraded the kafkaproducer to arroyo, I have some tests that hit that.
#     BUT get this, it doesn't close automatically.  (it expects only to close on process exit, not test exit)
#     Tests hang if any error occurs.  "Register a close method, that tests just call, to shut me down."
# 3.  I think it should be service oriented, not Resource oriented. (opinion)
#       Let's not, 100% mimick the ORM models.
#       Integrations is like, I need to query this model, that model, this model, that model, this model, now make request.
#       Resource: there is an endpoint per model, that becomes 5 concurrent API requests to pull in information.
#         around orms
#       Service: there is one endpoint, that queries all five models, and gives you the bundled result.
#         around workflows
#  4. ???? Do we use existing, or new?
#     If atleast, we have a 'service object', the backing implementation can change.
#  5.  Internal apis??
#      -- integrations mutual authentication. (alternative authentication model?)
