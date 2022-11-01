__all__ = ["from_user", "from_member", "DEFAULT"]

import abc
import dataclasses
from dataclasses import dataclass
from functools import cached_property
from typing import Collection, FrozenSet, Iterable, List, Mapping, Optional, Tuple, Union

import sentry_sdk
from django.conf import settings

from sentry import features, roles
from sentry.auth.superuser import is_active_superuser
from sentry.auth.system import is_system_auth
from sentry.models import (
    AuthIdentity,
    AuthProvider,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    Project,
    ProjectStatus,
    SentryApp,
    Team,
    TeamStatus,
    UserPermission,
    UserRole,
)
from sentry.roles import organization_roles
from sentry.roles.manager import OrganizationRole, TeamRole
from sentry.services.hybrid_cloud.organization import (
    ApiOrganization,
    ApiOrganizationMember,
    ApiProject,
    ApiTeam,
    ApiTeamMember,
    organization_service,
)
from sentry.silo import enforce_deprecated_code_path
from sentry.utils import metrics
from sentry.utils.request_cache import request_cache


@request_cache
def get_cached_organization_member(user_id: int, organization_id: int) -> OrganizationMember:
    return OrganizationMember.objects.get(user_id=user_id, organization_id=organization_id)


def get_permissions_for_user(user_id: int) -> FrozenSet[str]:
    return UserRole.permissions_for_user(user_id) | UserPermission.for_user(user_id)


def _sso_params(member: ApiOrganizationMember) -> Tuple[bool, bool]:
    """
    Return a tuple of (requires_sso, sso_is_valid) for a given member.
    """
    # TODO(dcramer): we want to optimize this access pattern as its several
    # network hops and needed in a lot of places
    try:
        auth_provider = AuthProvider.objects.get(organization=member.organization_id)
    except AuthProvider.DoesNotExist:
        sso_is_valid = True
        requires_sso = False
    else:
        if auth_provider.flags.allow_unlinked:
            requires_sso = False
            sso_is_valid = True
        else:
            requires_sso = True
            try:
                auth_identity = AuthIdentity.objects.get(
                    auth_provider=auth_provider, user=member.user_id
                )
            except AuthIdentity.DoesNotExist:
                sso_is_valid = False
                # If an owner is trying to gain access,
                # allow bypassing SSO if there are no other
                # owners with SSO enabled.
                if member.role == roles.get_top_dog().id:
                    requires_sso = AuthIdentity.objects.filter(
                        auth_provider=auth_provider,
                        user__in=OrganizationMember.objects.filter(
                            organization=member.organization_id,
                            role=roles.get_top_dog().id,
                            user__is_active=True,
                        )
                        .exclude(id=member.id)
                        .values_list("user_id"),
                    ).exists()
            else:
                sso_is_valid = auth_identity.is_valid(member)
    return requires_sso, sso_is_valid


@dataclass
class Access(abc.ABC):
    # TODO(dcramer): this is still a little gross, and ideally backend access
    # would be based on the same scopes as API access so there's clarity in
    # what things mean

    sso_is_valid: bool = False
    requires_sso: bool = False

    # if has_global_access is True, then any project
    # matching organization_id is valid. This is used for
    # both `organization.allow_joinleave` and to indicate
    # that the role is global / a user is an active superuser
    has_global_access: bool = False

    scopes: FrozenSet[str] = frozenset()
    permissions: FrozenSet[str] = frozenset()

    api_organization: Optional[ApiOrganization] = None
    api_member: Optional[ApiOrganizationMember] = None

    # public interface
    accessible_team_ids: Iterable[int] = dataclasses.field(default_factory=list)
    accessible_project_ids: Iterable[int] = dataclasses.field(default_factory=list)

    api_team_members: List[ApiTeamMember] = dataclasses.field(default_factory=list)
    api_projects: List[ApiProject] = dataclasses.field(default_factory=list)

    @property
    def member(self) -> Optional[OrganizationMember]:
        enforce_deprecated_code_path(
            "Access.member access is deprecated!  Try using api_member and querying the organization directly."
        )
        if self.api_member is not None:
            try:
                return OrganizationMember.objects.get(self.api_member.id)
            except OrganizationMember.NotFound:
                return None

    @property
    def role(self) -> Optional[str]:
        return self.api_member.role if self.api_member else None

    @cached_property
    def _team_memberships(self) -> Mapping[Team, OrganizationMemberTeam]:
        enforce_deprecated_code_path(
            "Access._team_membership is deprecated!  Try using api teams and querying the data directly."
        )
        if self.member is None:
            return {}
        return {
            omt.team: omt
            for omt in OrganizationMemberTeam.objects.filter(
                organizationmember=self.member, is_active=True, team__status=TeamStatus.VISIBLE
            ).select_related("team")
        }

    @cached_property
    def teams(self) -> FrozenSet[Team]:
        """Return the set of teams in which the user has actual membership."""
        enforce_deprecated_code_path(
            "Access.teams access is deprecated!  Try using api_teams and querying the data directly."
        )
        return frozenset(self._team_memberships.keys())

    @cached_property
    def projects(self) -> FrozenSet[Project]:
        """Return the set of projects to which the user has access via actual team membership."""
        enforce_deprecated_code_path(
            "Access.projects access is deprecated!  Try using api_projects and querying the data directly."
        )
        teams = self.teams
        if not teams:
            return frozenset()

        with sentry_sdk.start_span(op="get_project_access_in_teams") as span:
            projects = frozenset(
                Project.objects.filter(status=ProjectStatus.VISIBLE, teams__in=teams).distinct()
            )
            span.set_data("Project Count", len(projects))
            span.set_data("Team Count", len(teams))

        return projects

    def has_permission(self, permission: str) -> bool:
        """
        Return bool representing if the user has the given permission.

        >>> access.has_permission('broadcasts.admin')
        """
        return permission in self.permissions

    def has_scope(self, scope: str) -> bool:
        """
        Return bool representing if the user has the given scope.

        >>> access.has_project('org:read')
        """
        return scope in self.scopes

    def get_organization_role(self) -> Optional[OrganizationRole]:
        return self.role and organization_roles.get(self.role)

    @abc.abstractmethod
    def has_team_access(self, team: Union[Team, ApiTeam]) -> bool:
        """
        Return bool representing if a user should have access to information for the given team.

        >>> access.has_team_access(team)
        """
        raise NotImplementedError

    def has_team_scope(self, team: Union[Team, ApiTeam], scope: str) -> bool:
        """
        Return bool representing if a user should have access with the given scope to information
        for the given team.

        >>> access.has_team_scope(team, 'team:read')
        """
        if not self.has_team_access(team):
            return False
        if self.has_scope(scope):
            return True

        for member in self.api_member.teams:
            if member.team_id == team.id:
                if scope in member.scopes:
                    metrics.incr(
                        "team_roles.pass_by_team_scope",
                        tags={"team_role": member.role, "scope": scope},
                    )
                    return True
                else:
                    break

        return False

    def has_team_membership(self, team: Union[Team, ApiTeam]) -> bool:
        for t in self.api_team_members:
            if t.team_id == team.id:
                return True
        return False

    def get_team_role(self, team: Team) -> Optional[TeamRole]:
        for t in self.api_team_members:
            if t.team_id == team.id:
                return t.role
        return None

    @abc.abstractmethod
    def has_project_access(self, project: Union[Project, ApiProject]) -> bool:
        """
        Return bool representing if a user should have access to information for the given project.

        >>> access.has_project_access(project)
        """
        raise NotImplementedError

    def has_projects_access(self, projects: Iterable[Union[Project, ApiProject]]) -> bool:
        """
        Returns bool representing if a user should have access to every requested project
        """
        return all([self.has_project_access(project) for project in projects])

    def has_project_membership(self, project: Union[Project, ApiProject]) -> bool:
        """
        Return bool representing if a user has explicit membership for the given project.

        >>> access.has_project_membership(project)
        """
        for p in self.api_projects:
            if p.id == project.id:
                return True
        return False

    def has_project_scope(self, project: Union[Project, ApiProject], scope: str) -> bool:
        """
        Return bool representing if a user should have access with the given scope to information
        for the given project.

        >>> access.has_project_scope(project, 'project:read')
        """
        return self.has_any_project_scope(project, [scope])

    def has_any_project_scope(
        self, project: Union[Project, ApiProject], scopes: Collection[str]
    ) -> bool:
        """
        Represent if a user should have access with any one of the given scopes to
        information for the given project.

        For performance's sake, prefer this over multiple calls to `has_project_scope`.
        """
        if not self.has_project_access(project):
            return False
        if any(self.has_scope(scope) for scope in scopes):
            return True

        if self.api_member and features.has("organizations:team-roles", self.api_organization):
            with sentry_sdk.start_span(op="check_access_for_all_project_teams") as span:
                memberships: List[ApiTeamMember] = [
                    m for m in self.api_team_members if project.id in m.project_ids
                ]
                span.set_tag("organization", self.api_organization.id)
                span.set_tag("organization.slug", self.api_organization.slug)
                span.set_data("membership_count", len(memberships))

            for membership in memberships:
                for scope in scopes:
                    if scope in membership.scopes:
                        metrics.incr(
                            "team_roles.pass_by_project_scope",
                            tags={"team_role": membership.role, "scope": scope},
                        )
                        return True

        return False

    def to_django_context(self) -> Mapping[str, bool]:
        return {s.replace(":", "_"): self.has_scope(s) for s in settings.SENTRY_SCOPES}


class OrganizationMemberAccess(Access):
    def __init__(
        self,
        member: ApiOrganizationMember,
        org: ApiOrganization,
        scopes: Iterable[str],
        permissions: Iterable[str],
    ) -> None:
        requires_sso, sso_is_valid = _sso_params(member)
        has_global_access = bool(org.flags.allow_joinleave) or roles.get(member.role).is_global

        super().__init__(
            sso_is_valid=sso_is_valid,
            requires_sso=requires_sso,
            has_global_access=has_global_access,
            scopes=frozenset(scopes),
            permissions=frozenset(permissions),
            api_organization=org,
            api_member=member,
            api_team_members=member.teams,
            api_projects=member.projects,
        )

    def has_team_access(self, team: Union[Team, ApiTeam]) -> bool:
        if team.status != TeamStatus.VISIBLE:
            return False
        if self.has_global_access and self.api_member.organization_id == team.organization_id:
            return True
        return team in self.teams

    def has_project_access(self, project: Union[Project, ApiProject]) -> bool:
        if project.status != ProjectStatus.VISIBLE:
            return False
        if self.has_global_access and self.api_member.organization_id == project.organization_id:
            return True
        return project in self.projects


class OrganizationGlobalAccess(Access):
    """Access to all an organization's teams and projects."""

    def __init__(self, organization: ApiOrganization, scopes: Iterable[str], **kwargs):
        super().__init__(
            api_organization=organization,
            has_global_access=True,
            scopes=frozenset(scopes),
            **kwargs,
        )

    def has_team_access(self, team: Union[Team, ApiTeam]) -> bool:
        return (
            team.organization_id == self.api_organization.id and team.status == TeamStatus.VISIBLE
        )

    def has_project_access(self, project: Union[Project, ApiProject]) -> bool:
        return (
            project.organization_id == self.api_organization.id
            and project.status == ProjectStatus.VISIBLE
        )


class OrganizationGlobalMembership(OrganizationGlobalAccess):
    """Access to all an organization's teams and projects with simulated membership."""

    @cached_property
    def teams(self) -> FrozenSet[Team]:
        enforce_deprecated_code_path("OrganizationGlobalMembership.teams is deprecated!")
        return frozenset(
            Team.objects.filter(organization_id=self.api_organization.id, status=TeamStatus.VISIBLE)
        )

    @cached_property
    def projects(self) -> FrozenSet[Project]:
        enforce_deprecated_code_path("OrganizationGlobalMembership.projects is deprecated!")
        return frozenset(
            Project.objects.filter(
                organization_id=self.api_organization.id, status=ProjectStatus.VISIBLE
            )
        )

    def has_team_membership(self, team: Team) -> bool:
        return self.has_team_access(team)

    def has_project_membership(self, project: Project) -> bool:
        return self.has_project_access(project)


class OrganizationlessAccess(Access):
    def has_team_access(self, team: Team) -> bool:
        return False

    def has_project_access(self, project: Project) -> bool:
        return False


class SystemAccess(Access):
    def __init__(self) -> None:
        super().__init__(has_global_access=True)

    def has_permission(self, permission: str) -> bool:
        return True

    def has_scope(self, scope: str) -> bool:
        return True

    def has_team_access(self, team: Team) -> bool:
        return True

    def has_project_access(self, project: Project) -> bool:
        return True


class NoAccess(OrganizationlessAccess):
    def __init__(self) -> None:
        super().__init__(sso_is_valid=True)


def from_request(
    request,
    organization: Optional[Union[Organization, ApiOrganization]] = None,
    scopes: Optional[Iterable[str]] = None,
) -> Access:
    is_superuser = is_active_superuser(request)

    if isinstance(organization, Organization):
        organization = organization_service.get_organization_by_id(
            id=organization.id, user_id=request.user.id
        )

    if not organization:
        return from_user(request.user, organization=None, scopes=scopes, is_superuser=is_superuser)

    if getattr(request.user, "is_sentry_app", False):
        return _from_sentry_app(request.user, organization=organization)

    if is_superuser:
        member = organization.member
        if member is None:
            requires_sso, sso_is_valid = False, True
        else:
            requires_sso, sso_is_valid = _sso_params(member)

        return OrganizationGlobalAccess(
            organization=organization,
            api_member=member,
            api_team_members=member.teams,
            api_projects=member.projects,
            member=member,
            scopes=scopes if scopes is not None else settings.SENTRY_SCOPES,
            sso_is_valid=sso_is_valid,
            requires_sso=requires_sso,
            permissions=get_permissions_for_user(request.user.id),
        )

    if hasattr(request, "auth") and not request.user.is_authenticated:
        return from_auth(request.auth, organization)

    return from_user(request.user, organization, scopes=scopes)


# only used internally
def _from_sentry_app(user, organization: Optional[ApiOrganization] = None) -> Access:
    if not organization:
        return NoAccess()

    sentry_app_query = SentryApp.objects.filter(proxy_user=user)

    if not sentry_app_query.exists():
        return NoAccess()

    sentry_app = sentry_app_query.first()

    if not sentry_app.is_installed_on(organization_id=organization.id):
        return NoAccess()

    return OrganizationGlobalMembership(organization, sentry_app.scope_list, sso_is_valid=True)


def organizationless(user_id, is_superuser):
    return OrganizationlessAccess(
        permissions=get_permissions_for_user(user_id) if is_superuser else frozenset()
    )


def from_user(
    user,
    organization: Optional[Organization] = None,
    scopes: Optional[Iterable[str]] = None,
    is_superuser: bool = False,
) -> Access:
    if not user or user.is_anonymous or not user.is_active:
        return DEFAULT

    if not organization:
        return organizationless(user.id, is_superuser)

    lookup = organization_service.get_organization_by_slug(
        user_id=user.id, slug=organization.slug, only_visible=False
    )

    return _from_user(user, lookup, lookup.member, scopes=scopes, is_superuser=is_superuser)


def _from_user(
    user,
    organization: Optional[ApiOrganization] = None,
    organization_member: Optional[ApiOrganizationMember] = None,
    scopes: Optional[Iterable[str]] = None,
    is_superuser: bool = False,
) -> Access:
    if not user or user.is_anonymous or not user.is_active:
        return DEFAULT

    if not organization or not organization_member:
        return organizationless(user.id, is_superuser)

    return _from_member(organization_member, organization, scopes=scopes, is_superuser=is_superuser)


def from_member(
    member: OrganizationMember,
    scopes: Optional[Iterable[str]] = None,
    is_superuser: bool = False,
) -> Access:
    lookup = organization_service.get_organization_by_slug(
        user_id=member.user_id,
        slug=member.organization.slug,
        only_visible=False,
    )
    if lookup:
        member = lookup.member
    else:
        return DEFAULT
    return _from_member(member, lookup, scopes, is_superuser)


def _from_member(
    member: ApiOrganizationMember,
    org: ApiOrganization,
    scopes: Optional[Iterable[str]],
    is_superuser: bool,
) -> Access:
    if scopes is not None:
        scopes = set(scopes) & set(member.scopes)
    else:
        scopes = set(member.scopes)

    permissions = get_permissions_for_user(member.user_id) if is_superuser else frozenset()

    return OrganizationMemberAccess(member, org, scopes, permissions)


def from_auth(auth, organization: Organization) -> Access:
    if is_system_auth(auth):
        return SystemAccess()

    org = organization_service.get_organization_by_id(id=organization.id, user_id=None)
    return _from_auth(auth, org)


def _from_auth(auth, organization: ApiOrganization) -> Access:
    if is_system_auth(auth):
        return SystemAccess()
    if auth.organization_id == organization.id:
        return OrganizationGlobalAccess(organization, settings.SENTRY_SCOPES, sso_is_valid=True)
    else:
        return DEFAULT


DEFAULT = NoAccess()
