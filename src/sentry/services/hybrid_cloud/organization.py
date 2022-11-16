import dataclasses
from abc import abstractmethod
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Iterable, List, MutableMapping, Optional, Set, cast

from sentry.models import (
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    OrganizationStatus,
    Project,
    ProjectStatus,
    ProjectTeam,
    Team,
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


# This 'assumes' the naming conventions observed in the system thus far, but there is no enforcement currently,
# except that there would be an attribute exception (hopefully in tests).
def escape_flag_name(flag_name: str) -> str:
    return flag_name.replace(":", "__").replace("-", "_")


def unescape_flag_name(flag_name: str) -> str:
    return flag_name.replace("__", ":").replace("_", "-")


@dataclass
class ApiTeam:
    id: int = -1
    status: int = TeamStatus.VISIBLE
    organization_id: int = -1
    slug: str = ""


@dataclass
class ApiTeamMember:
    id: int = -1
    is_active: bool = False
    role: Optional[TeamRole] = None
    project_ids: List[int] = field(default_factory=list)
    scopes: List[str] = field(default_factory=list)
    team_id: int = -1


@dataclass
class ApiProject:
    id: int = -1
    slug: str = ""
    name: str = ""
    organization_id: int = -1
    status: int = ProjectStatus.VISIBLE


@dataclass
class ApiOrganizationMemberFlags:
    sso__linked: bool = False
    sso__invalid: bool = False
    member_limit__restricted: bool = False

    def __getattr__(self, item: str) -> bool:
        item = escape_flag_name(item)
        return bool(getattr(self, item))

    def __getitem__(self, item: str) -> bool:
        return bool(getattr(self, item))


@dataclass
class ApiOrganizationMember:
    id: int = -1
    organization_id: int = -1
    # This can be null when the user is deleted.
    user_id: Optional[int] = None
    member_teams: List[ApiTeamMember] = field(default_factory=list)
    role: str = ""
    project_ids: List[int] = field(default_factory=list)
    scopes: List[str] = field(default_factory=list)
    flags: ApiOrganizationMemberFlags = field(default_factory=lambda: ApiOrganizationMemberFlags())


@dataclass
class ApiOrganizationFlags:
    allow_joinleave: bool = False
    enhanced_privacy: bool = False
    disable_shared_issues: bool = False
    early_adopter: bool = False
    require_2fa: bool = False
    disable_new_visibility_features: bool = False
    require_email_verification: bool = False


@dataclass
class ApiOrganization:
    slug: str = ""
    id: int = -1
    name: str = ""

    # Represents the full set of teams and projects associated with the org.  Note that these are not filtered by
    # visibility, but you can apply a manual filter on the status attribute.
    teams: List[ApiTeam] = field(default_factory=list)
    projects: List[ApiProject] = field(default_factory=list)

    flags: ApiOrganizationFlags = field(default_factory=lambda: ApiOrganizationFlags())


@dataclass
class ApiUserOrganizationContext:
    """
    This object wraps an organization result inside of its membership context in terms of an (optional) user id.
    This is due to the large number of callsites that require an organization and a user's membership at the
    same time and in a consistency state.  This object allows a nice envelop for both of these ideas from a single
    transactional query.  Used by access, determine_active_organization, and others.
    """

    # user_id is None iff the get_organization_by_id call is not provided a user_id context.
    user_id: Optional[int] = None
    # The organization is always non-null because the null wrapping is around this object instead.
    # A None organization => a None ApiUserOrganizationContext
    organization: ApiOrganization = field(default_factory=lambda: ApiOrganization())
    # member can be None when the given user_id does not have membership with the given organization.
    # Note that all related fields of this organization member are filtered by visibility and is_active=True.
    member: Optional[ApiOrganizationMember] = None

    def __post_init__(self) -> None:
        # Ensures that outer user_id always agrees with the inner member object.
        if self.user_id is not None and self.member is not None:
            assert self.user_id == self.member.user_id


class OrganizationService(InterfaceWithLifecycle):
    @abstractmethod
    def get_organization_by_id(
        self, *, id: int, user_id: Optional[int]
    ) -> Optional[ApiUserOrganizationContext]:
        """
        Fetches the organization, team, and project data given by an organization id, regardless of its visibility
        status.  When user_id is provided, membership data related to that user from the organization
        is also given in the response.  See ApiUserOrganizationContext for more info.
        """
        pass

    @abstractmethod
    def get_organizations(
        self, user_id: Optional[int], scope: Optional[str], only_visible: bool
    ) -> List[ApiOrganization]:
        """
        When user_id is set, returns all organization and membership data associated with that user id given
        a scope and visibility requirement.  When user_id is None, provides all organizations across the entire
        system.
        When only_visible set, the organization object is only returned if it's status is Visible, otherwise any
        organization will be returned. NOTE: related resources, including membership, projects, and teams, will
        ALWAYS filter by status=VISIBLE.  To pull projects or teams that are not visible, use a different service
        endpoint.
        """
        pass

    @abstractmethod
    def check_membership_by_email(
        self, organization_id: int, email: str
    ) -> Optional[ApiOrganizationMember]:
        """
        Used to look up an organization membership by an email
        """
        pass

    @abstractmethod
    def check_membership_by_id(
        self, organization_id: int, user_id: int
    ) -> Optional[ApiOrganizationMember]:
        """
        Used to look up an organization membership by a user id
        """
        pass

    @abstractmethod
    def check_organization_by_slug(self, *, slug: str, only_visible: bool) -> Optional[int]:
        """
        If exists and matches the only_visible requirement, returns an organization's id by the slug.
        """
        pass

    def get_organization_by_slug(
        self, *, user_id: Optional[int], slug: str, only_visible: bool
    ) -> Optional[ApiUserOrganizationContext]:
        """
        Defers to check_organization_by_slug -> get_organization_by_id
        """
        org_id = self.check_organization_by_slug(slug=slug, only_visible=only_visible)
        if org_id is None:
            return None

        return self.get_organization_by_id(id=org_id, user_id=user_id)

    def _serialize_member_flags(self, member: OrganizationMember) -> ApiOrganizationMemberFlags:
        result = ApiOrganizationMemberFlags()
        for f in dataclasses.fields(ApiOrganizationMemberFlags):
            setattr(result, f.name, getattr(member.flags, unescape_flag_name(f.name)))
        return result

    def _serialize_member(
        self,
        member: OrganizationMember,
    ) -> ApiOrganizationMember:
        api_member = ApiOrganizationMember(
            id=member.id,
            organization_id=member.organization_id,
            user_id=member.user.id if member.user is not None else None,
            role=member.role,
            scopes=list(member.get_scopes()),
            flags=self._serialize_member_flags(member),
        )

        omts = OrganizationMemberTeam.objects.filter(
            organizationmember=member, is_active=True, team__status=TeamStatus.VISIBLE
        )

        all_project_ids: Set[int] = set()
        project_ids_by_team_id: MutableMapping[int, List[int]] = defaultdict(list)
        for pt in ProjectTeam.objects.filter(
            project__status=ProjectStatus.VISIBLE, team_id__in={omt.team_id for omt in omts}
        ):
            all_project_ids.add(pt.project_id)
            project_ids_by_team_id[pt.team_id].append(pt.project_id)

        for omt in omts:
            api_member.member_teams.append(
                self._serialize_team_member(omt, project_ids_by_team_id[omt.team_id])
            )
        api_member.project_ids = list(all_project_ids)

        return api_member

    def _serialize_flags(self, org: Organization) -> ApiOrganizationFlags:
        result = ApiOrganizationFlags()
        for f in dataclasses.fields(result):
            setattr(result, f.name, getattr(org.flags, f.name))
        return result

    def _serialize_team(self, team: Team) -> ApiTeam:
        return ApiTeam(
            id=team.id,
            status=team.status,
            organization_id=team.organization_id,
            slug=team.slug,
        )

    def _serialize_team_member(
        self, team_member: OrganizationMemberTeam, project_ids: Iterable[int]
    ) -> ApiTeamMember:
        result = ApiTeamMember(
            id=team_member.id,
            is_active=team_member.is_active,
            role=team_member.get_team_role(),
            team_id=team_member.team_id,
            project_ids=list(project_ids),
        )

        return result

    def _serialize_project(self, project: Project) -> ApiProject:
        return ApiProject(
            id=project.id,
            slug=project.slug,
            name=project.name,
            organization_id=project.organization_id,
            status=project.status,
        )

    def _serialize_organization(self, org: Organization) -> ApiOrganization:
        api_org: ApiOrganization = ApiOrganization(
            slug=org.slug,
            id=org.id,
            flags=self._serialize_flags(org),
            name=org.name,
        )

        projects: List[Project] = Project.objects.filter(organization=org)
        teams: List[Team] = Team.objects.filter(organization=org)
        api_org.projects.extend(self._serialize_project(project) for project in projects)
        api_org.teams.extend(self._serialize_team(team) for team in teams)
        return api_org


class DatabaseBackedOrganizationService(OrganizationService):
    def check_membership_by_id(
        self, organization_id: int, user_id: int
    ) -> Optional[ApiOrganizationMember]:
        try:
            member = OrganizationMember.objects.get(
                organization_id=organization_id, user_id=user_id
            )
        except OrganizationMember.DoesNotExist:
            return None

        return self._serialize_member(member)

    def get_organization_by_id(
        self, *, id: int, user_id: Optional[int]
    ) -> Optional[ApiUserOrganizationContext]:
        membership: Optional[ApiOrganizationMember] = None
        if user_id is not None:
            try:
                om = OrganizationMember.objects.get(organization_id=id, user_id=user_id)
                membership = self._serialize_member(om)
            except OrganizationMember.DoesNotExist:
                pass

        try:
            org = Organization.objects.get(id=id)
        except Organization.DoesNotExist:
            return None

        return ApiUserOrganizationContext(
            user_id=user_id, organization=self._serialize_organization(org), member=membership
        )

    def check_membership_by_email(
        self, organization_id: int, email: str
    ) -> Optional[ApiOrganizationMember]:
        try:
            member = OrganizationMember.objects.get(organization_id=organization_id, email=email)
        except OrganizationMember.DoesNotExist:
            return None

        return self._serialize_member(member)

    def check_organization_by_slug(self, *, slug: str, only_visible: bool) -> Optional[int]:
        try:
            org = Organization.objects.get_from_cache(slug=slug)
            if only_visible and org.status != OrganizationStatus.VISIBLE:
                raise Organization.DoesNotExist
            return cast(int, org.id)
        except Organization.DoesNotExist:
            logger.info("Organization by slug [%s] not found", slug)

        return None

    def close(self) -> None:
        pass

    def get_organizations(
        self, user_id: Optional[int], scope: Optional[str], only_visible: bool
    ) -> List[ApiOrganization]:
        if user_id is None:
            return []
        organizations = self._query_organizations(user_id, scope, only_visible)
        return [self._serialize_organization(o) for o in organizations]

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
