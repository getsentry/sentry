__all__ = ["from_user", "from_member", "DEFAULT"]

import warnings
from dataclasses import dataclass
from functools import cached_property
from typing import Collection, FrozenSet, Iterable, Mapping, Optional, Tuple

import sentry_sdk
from django.conf import settings

from sentry import roles
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
from sentry.utils.request_cache import request_cache


@request_cache
def get_cached_organization_member(user_id: int, organization_id: int) -> OrganizationMember:
    return OrganizationMember.objects.get(user_id=user_id, organization_id=organization_id)


def get_permissions_for_user(user_id: int) -> FrozenSet[str]:
    return UserRole.permissions_for_user(user_id) | UserPermission.for_user(user_id)


def _sso_params(member: OrganizationMember) -> Tuple[bool, bool]:
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


@dataclass(frozen=True, eq=True)
class TeamMembership:
    team: Team
    role: Optional[str] = None
    scopes: FrozenSet[str] = frozenset()

    @classmethod
    def from_team_member(cls, omt: OrganizationMemberTeam) -> "TeamMembership":
        return cls(omt.team, omt.role, omt.get_scopes())

    def has_scope(self, scope: str) -> bool:
        return scope in self.scopes


@dataclass(frozen=True)
class Access:
    # TODO(dcramer): this is still a little gross, and ideally backend access
    # would be based on the same scopes as API access so there's clarity in
    # what things mean

    is_active: bool = False
    sso_is_valid: bool = False
    requires_sso: bool = False
    organization_id: Optional[int] = None

    team_memberships: FrozenSet[TeamMembership] = frozenset()
    projects: FrozenSet[Project] = frozenset()  # projects with membership

    # if has_global_access is True, then any project
    # matching organization_id is valid. This is used for
    # both `organization.allow_joinleave` and to indicate
    # that the role is global / a user is an active superuser
    has_global_access: bool = False

    scopes: FrozenSet[str] = frozenset()
    permissions: FrozenSet[str] = frozenset()
    role: Optional[str] = None

    @cached_property
    def _team_table(self) -> Mapping[Team, TeamMembership]:
        return {tm.team: tm for tm in self.team_memberships}

    @property
    def teams(self) -> Collection[Team]:
        return self._team_table.keys()

    def has_permission(self, permission: str) -> bool:
        """
        Return bool representing if the user has the given permission.

        >>> access.has_permission('broadcasts.admin')
        """
        if not self.is_active:
            return False
        return permission in self.permissions

    def has_scope(self, scope: str) -> bool:
        """
        Return bool representing if the user has the given scope.

        >>> access.has_project('org:read')
        """
        if not self.is_active:
            return False
        return scope in self.scopes

    def has_team(self, team: Team) -> bool:
        warnings.warn("has_team() is deprecated in favor of has_team_access", DeprecationWarning)
        return self.has_team_access(team)

    def has_team_access(self, team: Team) -> bool:
        """
        Return bool representing if a user should have access to information for the given team.

        >>> access.has_team_access(team)
        """
        if not self.is_active:
            return False
        if self.has_global_access and self.organization_id == team.organization_id:
            return True
        return team in self.teams

    def has_team_scope(self, team: Team, scope: str) -> bool:
        """
        Return bool representing if a user should have access with the given scope to information
        for the given team.

        >>> access.has_team_scope(team, 'team:read')
        """
        if not self.has_team_access(team):
            return False
        if self.has_scope(scope):
            return True
        membership = self._team_table.get(team)
        return membership is not None and membership.has_scope(scope)

    def has_project_access(self, project: Project) -> bool:
        """
        Return bool representing if a user should have access to information for the given project.

        >>> access.has_project_access(project)
        """
        if not self.is_active:
            return False
        if self.has_global_access and self.organization_id == project.organization_id:
            return True
        return project in self.projects

    def has_projects_access(self, projects: Iterable[Project]) -> bool:
        """
        Returns bool representing if a user should have access to every requested project
        """
        return all([self.has_project_access(project) for project in projects])

    def has_project_membership(self, project: Project) -> bool:
        """
        Return bool representing if a user has explicit membership for the given project.

        >>> access.has_project_membership(project)
        """
        if not self.is_active:
            return False
        return project in self.projects

    def has_project_scope(self, project: Project, scope: str) -> bool:
        """
        Return bool representing if a user should have access with the given scope to information
        for the given project.

        >>> access.has_project_scope(project, 'project:read')
        """
        return self.has_project_access(project) and self.has_scope(scope)

    def to_django_context(self) -> Mapping[str, bool]:
        return {s.replace(":", "_"): self.has_scope(s) for s in settings.SENTRY_SCOPES}


class OrganizationGlobalAccess(Access):
    def __init__(self, organization: Organization):
        super().__init__(
            sso_is_valid=True,
            is_active=True,
            has_global_access=True,
            scopes=frozenset(settings.SENTRY_SCOPES),
            organization_id=organization.id,
        )

    def has_team_access(self, team: Team) -> bool:
        return team.organization_id == self.organization_id

    def has_project_access(self, project: Project) -> bool:
        return project.organization_id == self.organization_id

    def has_scope(self, scope: str) -> bool:
        return True


class OrganizationlessAccess(Access):
    def __init__(self, permissions: Iterable[str] = ()):
        super().__init__(is_active=True, permissions=frozenset(permissions))


class SystemAccess(Access):
    def __init__(self) -> None:
        super().__init__(is_active=True)

    def has_permission(self, permission: str) -> bool:
        return True

    def has_scope(self, scope: str) -> bool:
        return True

    def has_team_access(self, team: Team) -> bool:
        return True

    def has_project_access(self, project: Project) -> bool:
        return True

    def has_project_membership(self, project: Project) -> bool:
        return True


class NoAccess(Access):
    def __init__(self) -> None:
        super().__init__(sso_is_valid=True)


def from_request(
    request, organization: Organization = None, scopes: Optional[Iterable[str]] = None
) -> Access:
    is_superuser = is_active_superuser(request)

    if not organization:
        return from_user(
            request.user, organization=organization, scopes=scopes, is_superuser=is_superuser
        )

    if getattr(request.user, "is_sentry_app", False):
        return _from_sentry_app(request.user, organization=organization)

    if is_superuser:
        role = None
        # we special case superuser so that if they're a member of the org
        # they must still follow SSO checks, but they gain global access
        try:
            member = get_cached_organization_member(request.user.id, organization.id)
        except OrganizationMember.DoesNotExist:
            requires_sso, sso_is_valid = False, True
        else:
            requires_sso, sso_is_valid = _sso_params(member)
            role = member.role

        return Access(
            scopes=scopes if scopes is not None else settings.SENTRY_SCOPES,
            is_active=True,
            organization_id=organization.id if organization else None,
            sso_is_valid=sso_is_valid,
            requires_sso=requires_sso,
            has_global_access=True,
            permissions=get_permissions_for_user(request.user.id),
            role=role,
        )

    # TODO: from_auth does not take scopes as a parameter so this fails for anon user
    if hasattr(request, "auth") and not request.user.is_authenticated:
        return from_auth(request.auth, scopes=scopes)

    return from_user(request.user, organization, scopes=scopes)


# only used internally
def _from_sentry_app(user, organization: Optional[Organization] = None) -> Access:
    if not organization:
        return NoAccess()

    sentry_app = SentryApp.objects.get(proxy_user=user)

    if not sentry_app.is_installed_on(organization):
        return NoAccess()

    all_teams = list(Team.objects.filter(organization=organization))
    team_memberships = frozenset(TeamMembership(team) for team in all_teams)
    projects = frozenset(
        Project.objects.filter(status=ProjectStatus.VISIBLE, teams__in=all_teams).distinct()
    )

    return Access(
        scopes=sentry_app.scope_list,
        is_active=True,
        organization_id=organization.id,
        team_memberships=team_memberships,
        projects=projects,
        sso_is_valid=True,
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
        return OrganizationlessAccess(
            permissions=get_permissions_for_user(user.id) if is_superuser else ()
        )

    try:
        om = get_cached_organization_member(user.id, organization.id)
    except OrganizationMember.DoesNotExist:
        return OrganizationlessAccess(
            permissions=get_permissions_for_user(user.id) if is_superuser else ()
        )

    # ensure cached relation
    om.organization = organization

    return from_member(om, scopes=scopes, is_superuser=is_superuser)


def from_member(
    member: OrganizationMember,
    scopes: Optional[Iterable[str]] = None,
    is_superuser: bool = False,
) -> Access:
    # TODO(dcramer): we want to optimize this access pattern as its several
    # network hops and needed in a lot of places
    requires_sso, sso_is_valid = _sso_params(member)

    team_memberships = frozenset(
        TeamMembership.from_team_member(omt)
        for omt in OrganizationMemberTeam.objects.filter(organizationmember=member, is_active=True)
        if omt.team.status == TeamStatus.VISIBLE
    )
    team_list = [m.team for m in team_memberships]

    with sentry_sdk.start_span(op="get_project_access_in_teams") as span:
        project_list = frozenset(
            Project.objects.filter(status=ProjectStatus.VISIBLE, teams__in=team_list).distinct()
        )
        span.set_data("Project Count", len(project_list))
        span.set_data("Team Count", len(team_list))

    if scopes is not None:
        scopes = set(scopes) & member.get_scopes()
    else:
        scopes = member.get_scopes()

    return Access(
        is_active=True,
        requires_sso=requires_sso,
        sso_is_valid=sso_is_valid,
        scopes=scopes,
        organization_id=member.organization_id,
        team_memberships=team_memberships,
        projects=project_list,
        has_global_access=(
            bool(member.organization.flags.allow_joinleave) or roles.get(member.role).is_global
        ),
        permissions=get_permissions_for_user(member.user_id) if is_superuser else frozenset(),
        role=member.role,
    )


def from_auth(auth, organization: Organization) -> Access:
    if is_system_auth(auth):
        return SystemAccess()
    if auth.organization_id == organization.id:
        return OrganizationGlobalAccess(auth.organization)
    else:
        return DEFAULT


DEFAULT = NoAccess()
