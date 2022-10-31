from abc import abstractmethod
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Iterable, List, Optional

from sentry.models import (
    Organization,
    OrganizationMember,
    OrganizationStatus,
    ProjectStatus,
    TeamStatus,
)
from sentry.roles.manager import TeamRole
from sentry.services.hybrid_cloud import (
    CreateStubFromBase,
    InterfaceWithLifecycle,
    logger,
    silo_mode_delegation,
)
from sentry.silo import SiloMode


class ApiTeamStatus(IntEnum):
    VISIBLE = TeamStatus.VISIBLE
    PENDING_DELETION = TeamStatus.PENDING_DELETION
    DELETION_IN_PROGRESS = TeamStatus.DELETION_IN_PROGRESS


class ApiProjectStatus(IntEnum):
    VISIBLE = ProjectStatus.VISIBLE
    HIDDEN = ProjectStatus.HIDDEN
    PENDING_DELETION = ProjectStatus.PENDING_DELETION
    DELETION_IN_PROGRESS = ProjectStatus.DELETION_IN_PROGRESS


@dataclass
class ApiTeam:
    id: int = -1
    status: ApiTeamStatus = ApiTeamStatus.VISIBLE
    organization_id: int = -1
    slug: str = ""


@dataclass
class ApiTeamMember:
    id: int = -1
    is_active: bool = False
    role: Optional[TeamRole] = None
    project_ids: List[int] = field(default_factory=list)
    scopes: List[str] = field(default_factory=list)
    team: ApiTeam = field(default_factory=ApiTeam)


@dataclass
class ApiProject:
    id: int = -1
    slug: str = ""
    name: str = ""
    organization_id: int = -1
    status: ApiProjectStatus = ApiProjectStatus.VISIBLE


@dataclass
class ApiOrganizationMember:
    id: int = -1
    organization_id: int = -1
    # This can be null when the user is deleted.
    user_id: Optional[int] = None
    teams: List[ApiTeamMember] = field(default_factory=list)
    role: str = ""
    projects: List[ApiProject] = field(default_factory=list)
    scopes: List[str] = field(default_factory=list)


@dataclass
class ApiOrganization:
    slug: str = ""
    id: int = -1
    # exists if and only if the organization was queried with a user_id context, and that user_id
    # was confirmed to be a member.
    member: Optional[ApiOrganizationMember] = None

    # Represents the full set of teams and proejcts associated with the org.
    teams: List[ApiTeam] = field(default_factory=list)
    projects: List[ApiProject] = field(default_factory=list)

    allow_joinleave: bool = False
    enhanced_privacy: bool = False
    disable_shared_issues: bool = False
    early_adopter: bool = False
    require_2fa: bool = False
    disable_new_visibility_features: bool = False
    require_email_verification: bool = False


class OrganizationService(InterfaceWithLifecycle):
    @abstractmethod
    def get_organization_by_id(self, *, id: int) -> Optional[ApiOrganization]:
        """
        Returns an organization object by simply fetching for it by id.  Note that this is generally for
        systems lookup of organization objects and does not handle user scoping memberships.  For that,
        use `get_organization_by_slug` which is designed for looking up on behalf of a request user context.
        """
        pass

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
        api_org: ApiOrganization = ApiOrganization(slug=org.slug, id=org.id)

        for member in membership:
            if member.organization.id == org.id:
                api_org.member = self._serialize_member(member)
                break

        return api_org


class DatabaseBackedOrganizationService(OrganizationService):
    def get_organization_by_id(self, *, id: int) -> Optional[ApiOrganization]:
        try:
            return self._serialize_organization(Organization.objects.get(id))
        except Organization.NotFound:
            return None

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

    def close(self) -> None:
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


StubOrganizationService = CreateStubFromBase(DatabaseBackedOrganizationService)
organization_service: OrganizationService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: lambda: DatabaseBackedOrganizationService(),
        SiloMode.REGION: lambda: DatabaseBackedOrganizationService(),
        SiloMode.CONTROL: lambda: StubOrganizationService(),
    }
)
