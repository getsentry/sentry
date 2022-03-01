__all__ = ["from_user", "from_member", "DEFAULT"]

import abc
import warnings
from dataclasses import dataclass
from functools import cached_property
from typing import FrozenSet, Iterable, Mapping, Optional, Tuple

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
    role: Optional[str] = None

    @property
    @abc.abstractmethod
    def teams(self) -> FrozenSet[Team]:
        raise NotImplementedError

    @property
    @abc.abstractmethod
    def projects(self) -> FrozenSet[Project]:
        raise NotImplementedError

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

    def has_team(self, team: Team) -> bool:
        warnings.warn("has_team() is deprecated in favor of has_team_access", DeprecationWarning)
        return self.has_team_access(team)

    @abc.abstractmethod
    def has_team_access(self, team: Team) -> bool:
        """
        Return bool representing if a user should have access to information for the given team.

        >>> access.has_team_access(team)
        """
        raise NotImplementedError

    def has_team_scope(self, team: Team, scope: str) -> bool:
        """
        Return bool representing if a user should have access with the given scope to information
        for the given team.

        >>> access.has_team_scope(team, 'team:read')
        """
        return self.has_team_access(team) and self.has_scope(scope)

    @abc.abstractmethod
    def has_project_access(self, project: Project) -> bool:
        """
        Return bool representing if a user should have access to information for the given project.

        >>> access.has_project_access(project)
        """
        raise NotImplementedError

    def has_projects_access(self, projects: Iterable[Project]) -> bool:
        """
        Returns bool representing if a user should have access to every requested project
        """
        return all([self.has_project_access(project) for project in projects])

    @abc.abstractmethod
    def has_project_membership(self, project: Project) -> bool:
        """
        Return bool representing if a user has explicit membership for the given project.

        >>> access.has_project_membership(project)
        """
        raise NotImplementedError

    def has_project_scope(self, project: Project, scope: str) -> bool:
        """
        Return bool representing if a user should have access with the given scope to information
        for the given project.

        >>> access.has_project_scope(project, 'project:read')
        """
        return self.has_project_access(project) and self.has_scope(scope)

    def to_django_context(self) -> Mapping[str, bool]:
        return {s.replace(":", "_"): self.has_scope(s) for s in settings.SENTRY_SCOPES}


class OrganizationMemberAccess(Access):
    def __init__(
        self, member: OrganizationMember, scopes: Iterable[str], permissions: Iterable[str]
    ) -> None:
        self._member = member

        requires_sso, sso_is_valid = _sso_params(member)
        has_global_access = (
            bool(member.organization.flags.allow_joinleave) or roles.get(member.role).is_global
        )

        super().__init__(
            sso_is_valid=sso_is_valid,
            requires_sso=requires_sso,
            has_global_access=has_global_access,
            scopes=frozenset(scopes),
            permissions=frozenset(permissions),
            role=member.role,
        )

    @cached_property
    def teams(self) -> FrozenSet[Team]:
        return frozenset(self._member.get_teams())

    @cached_property
    def projects(self) -> FrozenSet[Project]:
        teams = self.teams

        with sentry_sdk.start_span(op="get_project_access_in_teams") as span:
            projects = frozenset(
                Project.objects.filter(status=ProjectStatus.VISIBLE, teams__in=teams).distinct()
            )
            span.set_data("Project Count", len(projects))
            span.set_data("Team Count", len(teams))

        return projects

    def has_team_access(self, team: Team) -> bool:
        if team.status != TeamStatus.VISIBLE:
            return False
        if self.has_global_access and self._member.organization.id == team.organization_id:
            return True
        return team in self.teams

    def has_project_access(self, project: Project) -> bool:
        if project.status != ProjectStatus.VISIBLE:
            return False
        if self.has_global_access and self._member.organization.id == project.organization_id:
            return True
        return self.has_project_membership(project)

    def has_project_membership(self, project: Project) -> bool:
        return project in self.projects


class OrganizationGlobalAccess(Access):
    def __init__(
        self,
        organization: Organization,
        scopes: Iterable[str],
        member: Optional[OrganizationMember] = None,
        **kwargs,
    ):
        self._organization = organization
        self._member = member

        super().__init__(has_global_access=True, scopes=frozenset(scopes), **kwargs)

    @cached_property
    def teams(self) -> FrozenSet[Team]:
        return frozenset(
            Team.objects.filter(organization=self._organization, status=TeamStatus.VISIBLE)
        )

    @cached_property
    def projects(self) -> FrozenSet[Project]:
        return frozenset(
            Project.objects.filter(organization=self._organization, status=ProjectStatus.VISIBLE)
        )

    def has_team_access(self, team: Team) -> bool:
        return team.organization_id == self._organization.id and team.status == TeamStatus.VISIBLE

    def has_project_access(self, project: Project) -> bool:
        return (
            project.organization_id == self._organization.id
            and project.status == ProjectStatus.VISIBLE
        )

    @cached_property
    def _member_delegate(self) -> Optional[OrganizationMemberAccess]:
        if self._member is None:
            return None
        return OrganizationMemberAccess(self._member, self.scopes, self.permissions)

    def has_project_membership(self, project: Project) -> bool:
        if self._member_delegate is None:
            return False
        return self._member_delegate.has_project_membership(project)


class OrganizationlessAccess(Access):
    @property
    def teams(self) -> FrozenSet[Team]:
        return frozenset()

    @property
    def projects(self) -> FrozenSet[Project]:
        return frozenset()

    def has_team_access(self, team: Team) -> bool:
        return False

    def has_project_access(self, project: Project) -> bool:
        return False

    def has_project_membership(self, project: Project) -> bool:
        return False


class SystemAccess(Access):
    def __init__(self) -> None:
        super().__init__()

    @property
    def teams(self) -> FrozenSet[Team]:
        warnings.warn("SystemAccess.teams is empty but has access to all teams")
        return frozenset()

    @property
    def projects(self) -> FrozenSet[Project]:
        warnings.warn("SystemAccess.projects is empty but has access to all projects")
        return frozenset()

    def has_permission(self, permission: str) -> bool:
        return True

    def has_scope(self, scope: str) -> bool:
        return True

    def has_team_access(self, team: Team) -> bool:
        return True

    def has_project_access(self, project: Project) -> bool:
        return True

    def has_project_membership(self, project: Project) -> bool:
        return False


class NoAccess(OrganizationlessAccess):
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
        member = None
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

        return OrganizationGlobalAccess(
            organization=organization,
            member=member,
            scopes=scopes if scopes is not None else settings.SENTRY_SCOPES,
            sso_is_valid=sso_is_valid,
            requires_sso=requires_sso,
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

    return OrganizationGlobalAccess(organization, sentry_app.scope_list, sso_is_valid=True)


def from_user(
    user,
    organization: Optional[Organization] = None,
    scopes: Optional[Iterable[str]] = None,
    is_superuser: bool = False,
) -> Access:
    if not user or user.is_anonymous or not user.is_active:
        return DEFAULT

    def organizationless():
        return OrganizationlessAccess(
            permissions=get_permissions_for_user(user.id) if is_superuser else frozenset(),
        )

    if not organization:
        return organizationless()

    try:
        om = get_cached_organization_member(user.id, organization.id)
    except OrganizationMember.DoesNotExist:
        return organizationless()

    # ensure cached relation
    om.organization = organization

    return from_member(om, scopes=scopes, is_superuser=is_superuser)


def from_member(
    member: OrganizationMember,
    scopes: Optional[Iterable[str]] = None,
    is_superuser: bool = False,
) -> Access:
    if scopes is not None:
        scopes = set(scopes) & member.get_scopes()
    else:
        scopes = member.get_scopes()

    permissions = get_permissions_for_user(member.user_id) if is_superuser else frozenset()

    return OrganizationMemberAccess(member, scopes, permissions)


def from_auth(auth, organization: Organization) -> Access:
    if is_system_auth(auth):
        return SystemAccess()
    if auth.organization_id == organization.id:
        return OrganizationGlobalAccess(
            auth.organization, settings.SENTRY_SCOPES, sso_is_valid=True
        )
    else:
        return DEFAULT


DEFAULT = NoAccess()
