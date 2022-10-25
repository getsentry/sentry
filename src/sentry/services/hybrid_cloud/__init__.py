import contextlib
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Generic, Iterable, List, Mapping, Optional, Type, TypeVar, cast

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
class ApiOrganizationMember:
    # This can be null when the user is deleted.
    user_id: Optional[int]
    pass


@dataclass
class ApiOrganization:
    slug: str = ""
    id: int = -1
    # exists iff the organization was queried with a user_id context, and that user_id
    # was confirmed to be a member.
    member: Optional[ApiOrganizationMember] = None


class InterfaceWithLifecycle(ABC):
    @abstractmethod
    def close(self):
        pass


ServiceInterface = TypeVar("ServiceInterface", bound=InterfaceWithLifecycle)


class DelegatedBySiloMode(Generic[ServiceInterface]):
    """
    Using a mapping of silo modes to backing type classes that match the same ServiceInterface,
    delegate method calls to a singleton that is managed based on the current SiloMode.get_current_mode().
    This delegator is dynamic -- it knows to swap the backing implementation even when silo mode is overwritten
    during run time, or even via the stubbing methods in this module.

    It also supports lifecycle management by invoking close() on the backing implementation anytime either this
    service is closed, or when the backing service implementation changes.
    """

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
        self, user_id: Optional[int], scope: Optional[str], only_visible: bool
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
    def check_membership_by_email(
        self, organization_id: int, email: str
    ) -> Optional[ApiOrganizationMember]:
        """
        Used to look up an organization membership by an email, used in very specific edge cases.
        """
        pass

    @abstractmethod
    def get_organization_by_slug(
        self, *, user_id: Optional[int], slug: str, only_visible: bool, allow_stale: bool
    ) -> Optional[ApiOrganization]:
        pass

    def _serialize_member(self, member: OrganizationMember) -> ApiOrganizationMember:
        return ApiOrganizationMember(user_id=member.user.id if member.user is not None else None)

    def _serialize_organization(
        self, org: Organization, membership: Iterable[OrganizationMember] = tuple()
    ) -> ApiOrganization:
        org = ApiOrganization(slug=org.slug, id=org.id)

        for member in membership:
            if member.organization.id == org.id:
                org.member = self._serialize_member(member)
                break

        return org


class DatabaseBackedOrganizationService(OrganizationService):
    def check_membership_by_email(
        self, organization_id: int, email: str
    ) -> Optional[ApiOrganizationMember]:
        try:
            member = OrganizationMember.objects.get(organization_id=organization_id, email=email)
        except OrganizationMember.DoesNotExist:
            return None

        return self._serialize_member(member)

    def get_organization_by_slug(
        self, *, user_id: Optional[int], slug: str, only_visible: bool, allow_stale: bool
    ) -> Optional[ApiOrganization]:
        membership: List[OrganizationMember]
        if user_id is not None:
            membership = OrganizationMember.objects.filter(user_id=user_id)
        else:
            membership = []
        try:
            if allow_stale:
                org = Organization.objects.get_from_cache(slug=slug)
            else:
                org = Organization.objects.get(slug=slug)

            if only_visible and org.status != OrganizationStatus.VISIBLE:
                raise Organization.DoesNotExist
            return self._serialize_organization(org, membership)
        except Organization.DoesNotExist:
            logger.info("Active organization [%s] not found", slug)

        return None

    def close(self):
        pass

    def get_organizations(
        self, user_id: Optional[int], scope: Optional[str], only_visible: bool
    ) -> List[ApiOrganization]:
        if user_id is None:
            return []
        organizations = self._query_organizations(user_id, scope, only_visible)
        membership = OrganizationMember.objects.filter(user_id=user_id)
        return [self._serialize_organization(o, membership) for o in organizations]

    def _query_organizations(
        self, user_id: int, scope: Optional[str], only_visible: bool
    ) -> List[Organization]:
        from django.conf import settings

        if settings.SENTRY_PUBLIC and scope is None:
            if only_visible:
                return list(Organization.objects.filter(status=OrganizationStatus.ACTIVE))
            else:
                return list(Organization.objects.filter())

        qs = OrganizationMember.objects.filter(user_id=user_id)

        qs = qs.select_related("organization")
        if only_visible:
            qs = qs.filter(organization__status=OrganizationStatus.ACTIVE)

        results = list(qs)

        if scope is not None:
            return [r.organization for r in results if scope in r.get_scopes()]

        return [r.organization for r in results]


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


def CreateStubFromBase(base: Type[ServiceInterface]) -> Type[ServiceInterface]:
    """
    Using a concrete implementation class of a service, creates a new concrete implementation class suitable for a test
    stub.  It retains parity with the given base by passing through all of its abstract method implementations to the
    given base class, but wraps it with `exempt_from_silo_limits`, allowing tests written for monolith mode to largely
    work symmetrically.  In the future, however, when monolith mode separate is deprecated, this logic should be
    replaced by true mocking utilities.

    This implementation will not work outside of test contexts.
    """
    Super = base.__bases__[0]

    def __init__(self, *args, **kwds):
        Super.__init__(self, *args, **kwds)
        self.backing_service = base(*args, **kwds)

    def close(self):
        self.backing_service.close()

    def make_method(method_name: str):
        def method(self, *args, **kwds):
            from sentry.testutils.silo import exempt_from_silo_limits

            with exempt_from_silo_limits():
                return getattr(self.backing_service, method_name)(*args, **kwds)

        return method

    methods = {
        name: make_method(name)
        for name in dir(Super)
        if getattr(getattr(Super, name), "__isabstractmethod__", False)
    }

    methods["close"] = close
    methods["__init__"] = __init__

    return cast(Type[ServiceInterface], type(f"Stub{Super.__name__}", (Super,), methods))


StubProjectKeyService = CreateStubFromBase(DatabaseBackedProjectKeyService)
StubOrganizationService = CreateStubFromBase(DatabaseBackedOrganizationService)


def silo_mode_delegation(mapping: Mapping[SiloMode, Type[ServiceInterface]]) -> ServiceInterface:
    """
    Simply creates a DelegatedBySiloMode from a mapping object, but casts it as a ServiceInterface matching
    the mapping values.
    """
    return cast(InterfaceWithLifecycle, DelegatedBySiloMode(mapping))


@contextlib.contextmanager
def service_stubbed(
    service: InterfaceWithLifecycle,
    stub: Optional[InterfaceWithLifecycle],
    silo_mode: Optional[SiloMode] = None,
):
    """
    Replaces a service created with silo_mode_delegation with a replacement implementation while inside of the scope,
    closing the existing implementation on enter and closing the given implementation on exit.
    """
    if silo_mode is None:
        silo_mode = SiloMode.get_current_mode()

    if isinstance(service, DelegatedBySiloMode):
        with service.with_replacement(stub, silo_mode):
            yield
    else:
        raise ValueError("Service needs to be a DelegatedBySilMode object, but it was not!")


@contextlib.contextmanager
def use_real_service(service: InterfaceWithLifecycle, silo_mode: SiloMode):
    """
    Removes any stubbed implementations, forcing the default configured implementation.
    Important for integration tests that validate the integration of production service implementations.
    """
    from django.test import override_settings

    if silo_mode is None:
        silo_mode = SiloMode.get_current_mode()

    if isinstance(service, DelegatedBySiloMode):
        with override_settings(SILO_MODE=silo_mode):
            with service.with_replacement(None, silo_mode):
                yield
    else:
        raise ValueError("Service needs to be a DelegatedBySiloMode object, but it was not!")


class RegionClientBackedProjectKeyService(ProjectKeyService):
    def get_project_key(self, project_id: str, role: ProjectKeyRole) -> Optional[ApiProjectKey]:
        pass

    def close(self):
        pass


class RegionClientBackedOrganizationService(ProjectKeyService):
    def get_project_key(self, project_id: str, role: ProjectKeyRole) -> Optional[ApiProjectKey]:
        pass

    def close(self):
        pass


project_key_service: ProjectKeyService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: DatabaseBackedProjectKeyService,
        SiloMode.REGION: DatabaseBackedProjectKeyService,
        SiloMode.CONTROL: StubProjectKeyService,
    }
)

organization_service: OrganizationService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: DatabaseBackedOrganizationService,
        SiloMode.REGION: DatabaseBackedOrganizationService,
        SiloMode.CONTROL: StubOrganizationService,
    }
)
