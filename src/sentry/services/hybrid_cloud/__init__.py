import contextlib
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Generic, List, Mapping, Optional, Type, TypeVar, cast

from sentry.models import Organization, OrganizationMember, OrganizationStatus

logger = logging.getLogger(__name__)

from django.db.models import F

from sentry.silo import SiloMode


class ProjectKeyRole(Enum):
    store = "store"
    api = "api"

    def as_orm_role(self):
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


@dataclass
class ApiOrganization:
    slug: str = ""
    id: int = -1


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


class OrganizationService(InterfaceWithLifecycle):
    @abstractmethod
    def get_organizations(
        self, user_id: Optional[id], scope: Optional[str], only_visible: bool
    ) -> List[ApiOrganization]:
        """
        This method is expected to follow the optionally given user_id, scope, and only_visible options to filter
        an appropriate set.
        :param user_id:
        When null, this should imply the entire set of organizations, not bound by user.  Be certain to authenticate
        users before returning this.
        :param scope:
        :param only_visible:
        :return:
        """
        pass

    @abstractmethod
    def get_organization_by_slug(
        self, slug: str, only_visible: bool, allow_stale: bool
    ) -> Optional[ApiOrganization]:
        pass


class DatabaseBackedOrganizationService(OrganizationService):
    def _serialize_organization(self, org: Organization) -> ApiOrganization:
        return ApiOrganization(
            slug=org.slug,
            id=org.id,
        )

    def get_organization_by_slug(
        self, slug: str, only_visible: bool, allow_stale: bool
    ) -> Optional[ApiOrganization]:
        try:
            if allow_stale:
                org = Organization.objects.get_from_cache(slug=slug)
            else:
                org = Organization.objects.get(slug=slug)

            if only_visible and org.status != OrganizationStatus.VISIBLE:
                raise Organization.DoesNotExist
            return self._serialize_organization(org)
        except Organization.DoesNotExist:
            logger.info("Active organization [%s] not found", slug)

        return None

    def close(self):
        pass

    def get_organizations(
        self, user_id: Optional[id], scope: Optional[str], only_visible: bool
    ) -> List[ApiOrganization]:
        from django.conf import settings

        if settings.SENTRY_PUBLIC and scope is None:
            if only_visible:
                return list(Organization.objects.filter(status=OrganizationStatus.ACTIVE))
            else:
                return list(Organization.objects.filter())

        if user_id is not None:
            qs = OrganizationMember.objects.filter(user_id=user_id)
        else:
            qs = OrganizationMember.objects.filter()

        qs = qs.select_related("organization")
        if only_visible:
            qs = qs.filter(organization__status=OrganizationStatus.ACTIVE)

        results = list(qs)

        if scope is not None:
            return [r.organization for r in results if scope in r.get_scopes()]

        return [self._serialize_organization(r.organization) for r in results]


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


class StubOrganizationService(OrganizationService):
    def get_organizations(
        self, user_id: Optional[id], scope: Optional[str], only_visible: bool
    ) -> List[ApiOrganization]:
        pass

    def get_organization_by_slug(
        self, slug: str, only_visible: bool, allow_stale: bool
    ) -> Optional[ApiOrganization]:
        pass

    def close(self):
        pass


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

organization_service: OrganizationService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: DatabaseBackedOrganizationService,
        SiloMode.REGION: DatabaseBackedOrganizationService,
        SiloMode.CONTROL: StubOrganizationService,
    }
)


def close_all():
    for v in locals().values():
        if isinstance(v, DelegatedBySiloMode):
            v.close()
