import dataclasses
from abc import abstractmethod
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Iterable, List, Mapping, Optional, Sequence

from sentry.models import (
    Organization,
    OrganizationMember,
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
    # exists if and only if the organization was queried with a user_id context, and that user_id
    # was confirmed to be a member.
    member: Optional[ApiOrganizationMember] = None
    name: str = ""

    # Represents the full set of teams and projects associated with the org.
    teams: List[ApiTeam] = field(default_factory=list)
    projects: List[ApiProject] = field(default_factory=list)

    flags: ApiOrganizationFlags = field(default_factory=lambda: ApiOrganizationFlags())


class OrganizationService(InterfaceWithLifecycle):
    @abstractmethod
    def get_organization_by_id(
        self, *, id: int, user_id: Optional[int]
    ) -> Optional[ApiOrganization]:
        """
        Fetches the organization, team, and project data given by an organization id.  When user_id is provided,
        membership data related to that user from the organization is also given in the response.
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
    def check_organization_by_slug(self, *, slug: str, only_visible: bool) -> Optional[int]:
        """
        If exists and matches the only_visible requirement, returns an organization's id by the slug.
        When allow_stale is true, returns
        """
        pass

    def get_organization_by_slug(
        self, *, user_id: Optional[int], slug: str, only_visible: bool
    ) -> Optional[ApiOrganization]:
        org_id = self.check_organization_by_slug(slug=slug, only_visible=only_visible)
        if org_id is None:
            return None

        return self.get_organization_by_id(id=org_id, user_id=user_id)

    def _serialize_member(
        self,
        member: OrganizationMember,
        team_to_project_ids: Optional[Mapping[int, int]] = None,
        projects: Optional[List[Project]] = None,
    ) -> ApiOrganizationMember:
        api_member = ApiOrganizationMember(
            id=member.id,
            organization_id=member.organization_id,
            user_id=member.user.id if member.user is not None else None,
            role=member.role,
            scopes=list(member.get_scopes()),
        )

        api_member.teams = [self._serialize_team(t) for t in member.teams]

        if projects is None:
            projects = Project.objects.filter(
                projectteam__team__organizationmemberteam__organizationmember=member
            )
        else:
            project_ids = {team_to_project_ids[t.id] for t in member.teams}
            projects = [p for p in projects if p.id in project_ids]

        api_member.projects = [self._serialize_project(p) for p in projects]

        return api_member

    def _serialize_flags(self, org: Organization) -> ApiOrganizationFlags:
        result = ApiOrganizationFlags()
        for f in dataclasses.fields(result):
            setattr(f, f.name, getattr(org.flags, f.name))
        return result

    def _serialize_team(self, team: Team) -> ApiTeam:
        return ApiTeam(
            id=team.id,
            status=team.status,
            organization_id=team.organization_id,
            slug=team.slug,
        )

    def _serialize_project(self, project: Project) -> ApiProject:
        return ApiProject(
            id=project.id,
            slug=project.slug,
            name=project.name,
            organization_id=project.organization_id,
            status=project.status,
        )

    def _serialize_organization(
        self, org: Organization, membership: Iterable[OrganizationMember] = tuple()
    ) -> ApiOrganization:
        api_org: ApiOrganization = ApiOrganization(
            slug=org.slug,
            id=org.id,
            flags=self._serialize_flags(org),
            name=org.name,
        )

        teams = Team.objects.filter(organization_id=org.id)
        projects = Project.objects.filter(organization_id=org.id)
        team_to_project_ids = {
            t.team_id: t.project_id
            for t in ProjectTeam.objects.filter(project_id__in=[p.id for p in projects])
        }

        api_org.teams = [self._serialize_team(t) for t in teams]
        api_org.projects = [self._serialize_project(p) for p in projects]

        for member in membership:
            if member.organization.id == org.id:
                api_org.member = self._serialize_member(member, team_to_project_ids, projects)
                break

        return api_org


class DatabaseBackedOrganizationService(OrganizationService):
    def get_organization_by_id(
        self, *, id: int, user_id: Optional[int]
    ) -> Optional[ApiOrganization]:
        membership: Sequence[OrganizationMember]
        if user_id is not None:
            membership = OrganizationMember.objects.filter(user_id=user_id).prefetch_related(
                "teams"
            )
        else:
            membership = []

        try:
            org = Organization.objects.get(id)
        except Organization.DoesNotExist:
            return None

        return self._serialize_organization(org, membership)

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
            org = Organization.objects.get(slug=slug)
            if only_visible and org.status != OrganizationStatus.VISIBLE:
                raise Organization.DoesNotExist
            return org.id
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
