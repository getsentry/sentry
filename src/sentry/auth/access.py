from __future__ import annotations

__all__ = ["from_user", "from_member", "DEFAULT"]

import abc
from dataclasses import dataclass
from functools import cached_property
from typing import Any, Collection, FrozenSet, Iterable, Mapping, cast

import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.http.request import HttpRequest

from sentry import features, roles
from sentry.auth.superuser import is_active_superuser
from sentry.auth.system import SystemToken, is_system_auth
from sentry.models import (
    ApiKey,
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
    User,
    UserPermission,
    UserRole,
)
from sentry.roles import organization_roles
from sentry.roles.manager import OrganizationRole, TeamRole
from sentry.utils import metrics
from sentry.utils.request_cache import request_cache


@request_cache
def get_cached_organization_member(user_id: int, organization_id: int) -> OrganizationMember:
    return OrganizationMember.objects.get(user_id=user_id, organization_id=organization_id)


def get_permissions_for_user(user_id: int) -> FrozenSet[str]:
    union = UserRole.permissions_for_user(user_id) | UserPermission.for_user(user_id)
    return cast(FrozenSet[str], union)


@dataclass(frozen=True, eq=True)
class SsoState:
    is_required: bool
    is_valid: bool


_SSO_BYPASS = SsoState(False, True)


def _sso_params(member: OrganizationMember) -> SsoState:
    """
    Check whether SSO is required and valid for a given member.
    """
    # TODO(dcramer): we want to optimize this access pattern as its several
    # network hops and needed in a lot of places
    try:
        auth_provider = AuthProvider.objects.get(organization=member.organization_id)
    except AuthProvider.DoesNotExist:
        return _SSO_BYPASS

    if auth_provider.flags.allow_unlinked:
        return _SSO_BYPASS

    try:
        auth_identity = AuthIdentity.objects.get(auth_provider=auth_provider, user=member.user_id)
    except AuthIdentity.DoesNotExist:
        # If an owner is trying to gain access, allow bypassing SSO if there are no
        # other owners with SSO enabled.
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
            requires_sso = True
        return SsoState(requires_sso, False)

    sso_is_valid = auth_identity.is_valid(member)
    return SsoState(True, sso_is_valid)


@dataclass
class Access(abc.ABC):
    # TODO(dcramer): this is still a little gross, and ideally backend access
    # would be based on the same scopes as API access so there's clarity in
    # what things mean

    _sso_state: SsoState = SsoState(False, False)

    @property
    def sso_is_valid(self) -> bool:
        return self._sso_state.is_valid

    @property
    def requires_sso(self) -> bool:
        return self._sso_state.is_required

    # if has_global_access is True, then any project
    # matching organization_id is valid. This is used for
    # both `organization.allow_joinleave` and to indicate
    # that the role is global / a user is an active superuser
    has_global_access: bool = False

    scopes: FrozenSet[str] = frozenset()
    permissions: FrozenSet[str] = frozenset()

    _member: OrganizationMember | None = None

    @property
    def role(self) -> str | None:
        return self._member.role if self._member else None

    @cached_property
    def _team_memberships(self) -> Mapping[Team, OrganizationMemberTeam]:
        if self._member is None:
            return {}
        return {
            omt.team: omt
            for omt in OrganizationMemberTeam.objects.filter(
                organizationmember=self._member, is_active=True, team__status=TeamStatus.VISIBLE
            ).select_related("team")
        }

    @cached_property
    def team_ids_with_membership(self) -> FrozenSet[int]:
        """Return the IDs of teams in which the user has actual membership.

        This represents the set of all teams for which `has_team_membership` returns
        true. Use that method where possible and use this property only when you need
        to iterate or query for all such teams.

        Compare to accessible_team_ids, which is equal to this property in the
        typical case but represents a superset of IDs in case of superuser access.
        """
        return frozenset(team.id for team in self._team_memberships.keys())

    @property
    def accessible_team_ids(self) -> FrozenSet[int]:
        """Return the IDs of teams to which the user has access.

        This represents the set of all teams for which `has_team_access` returns
        true. Use that method where possible and use this property only when you need
        to iterate or query for all such teams.
        """
        return self.team_ids_with_membership

    @cached_property
    def project_ids_with_team_membership(self) -> FrozenSet[int]:
        """Return the IDs of projects to which the user has access via actual team membership.

        This represents the set of all projects for which `has_project_membership`
        returns true. Use that method where possible and use this property only when
        you need to iterate or query for all such teams.

        Compare to accessible_project_ids, which is equal to this property in the
        typical case but represents a superset of IDs in case of superuser access.
        """
        teams = self._team_memberships.keys()
        if not teams:
            return frozenset()

        with sentry_sdk.start_span(op="get_project_access_in_teams") as span:
            projects = frozenset(
                Project.objects.filter(status=ProjectStatus.VISIBLE, teams__in=teams)
                .distinct()
                .values_list("id", flat=True)
            )
            span.set_data("Project Count", len(projects))
            span.set_data("Team Count", len(teams))

        return projects

    @property
    def accessible_project_ids(self) -> FrozenSet[int]:
        """Return the IDs of projects to which the user has access.

        This represents the set of all teams for which `has_project_access` returns
        true. Use that method where possible and use this property only when you need
        to iterate or query for all such teams.
        """
        return self.project_ids_with_team_membership

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

    def get_organization_role(self) -> OrganizationRole | None:
        return organization_roles.get(self.role) if self.role else None

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
        if not self.has_team_access(team):
            return False
        if self.has_scope(scope):
            return True

        membership = self._team_memberships.get(team)
        if membership is not None and scope in membership.get_scopes():
            metrics.incr(
                "team_roles.pass_by_team_scope",
                tags={"team_role": membership.role, "scope": scope},
            )
            return True

        return False

    def has_team_membership(self, team: Team) -> bool:
        return team.id in self.team_ids_with_membership

    def get_team_role(self, team: Team) -> TeamRole | None:
        team_member = self._team_memberships.get(team)
        return team_member and team_member.get_team_role()

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

    def has_project_membership(self, project: Project) -> bool:
        """
        Return bool representing if a user has explicit membership for the given project.

        >>> access.has_project_membership(project)
        """
        return project.id in self.project_ids_with_team_membership

    def has_project_scope(self, project: Project, scope: str) -> bool:
        """
        Return bool representing if a user should have access with the given scope to information
        for the given project.

        >>> access.has_project_scope(project, 'project:read')
        """
        return self.has_any_project_scope(project, [scope])

    def has_any_project_scope(self, project: Project, scopes: Collection[str]) -> bool:
        """
        Represent if a user should have access with any one of the given scopes to
        information for the given project.

        For performance's sake, prefer this over multiple calls to `has_project_scope`.
        """
        if not self.has_project_access(project):
            return False
        if any(self.has_scope(scope) for scope in scopes):
            return True

        if self._member and features.has("organizations:team-roles", self._member.organization):
            with sentry_sdk.start_span(op="check_access_for_all_project_teams") as span:
                memberships = [
                    self._team_memberships[team]
                    for team in project.teams.all()
                    if team in self._team_memberships
                ]
                span.set_tag("organization", self._member.organization.id)
                span.set_tag("organization.slug", self._member.organization.slug)
                span.set_data("membership_count", len(memberships))

            for membership in memberships:
                team_scopes = membership.get_scopes()
                for scope in scopes:
                    if scope in team_scopes:
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
        self, member: OrganizationMember, scopes: Iterable[str], permissions: Iterable[str]
    ) -> None:
        has_global_access = (
            bool(member.organization.flags.allow_joinleave) or roles.get(member.role).is_global
        )

        super().__init__(
            _member=member,
            _sso_state=_sso_params(member),
            has_global_access=has_global_access,
            scopes=frozenset(scopes),
            permissions=frozenset(permissions),
        )

    def has_team_access(self, team: Team) -> bool:
        assert self._member is not None
        if team.status != TeamStatus.VISIBLE:
            return False
        if self.has_global_access and self._member.organization.id == team.organization_id:
            return True
        return team.id in self.team_ids_with_membership

    def has_project_access(self, project: Project) -> bool:
        assert self._member is not None
        if project.status != ProjectStatus.VISIBLE:
            return False
        if self.has_global_access and self._member.organization.id == project.organization_id:
            return True
        return project.id in self.project_ids_with_team_membership


class OrganizationGlobalAccess(Access):
    """Access to all an organization's teams and projects."""

    def __init__(self, organization: Organization, scopes: Iterable[str], **kwargs: Any) -> None:
        self._organization = organization

        super().__init__(has_global_access=True, scopes=frozenset(scopes), **kwargs)

    def has_team_access(self, team: Team) -> bool:
        return bool(
            team.organization_id == self._organization.id and team.status == TeamStatus.VISIBLE
        )

    def has_project_access(self, project: Project) -> bool:
        return bool(
            project.organization_id == self._organization.id
            and project.status == ProjectStatus.VISIBLE
        )

    @cached_property
    def accessible_team_ids(self) -> FrozenSet[int]:
        return frozenset(
            Team.objects.filter(
                organization=self._organization, status=TeamStatus.VISIBLE
            ).values_list("id", flat=True)
        )

    @cached_property
    def accessible_project_ids(self) -> FrozenSet[int]:
        return frozenset(
            Project.objects.filter(
                organization=self._organization, status=ProjectStatus.VISIBLE
            ).values_list("id", flat=True)
        )


class OrganizationGlobalMembership(OrganizationGlobalAccess):
    """Access to all an organization's teams and projects with simulated membership."""

    @property
    def team_ids_with_membership(self) -> FrozenSet[int]:
        return self.accessible_team_ids

    @property
    def project_ids_with_team_membership(self) -> FrozenSet[int]:
        return self.accessible_project_ids

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

    # The semantically correct behavior for accessible_(team|project)_ids would be to
    # query for all teams or projects in the system, which we don't want to attempt.
    # Code paths that may have SystemAccess must avoid looking at these properties.

    @property
    def accessible_team_ids(self) -> FrozenSet[int]:
        raise Exception("Cannot list all accessible teams for SystemAccess")

    @property
    def accessible_project_ids(self) -> FrozenSet[int]:
        raise Exception("Cannot list all accessible projects for SystemAccess")


class NoAccess(OrganizationlessAccess):
    def __init__(self) -> None:
        super().__init__(_sso_state=_SSO_BYPASS)


def from_request(
    request: HttpRequest,
    organization: Organization = None,
    scopes: Iterable[str] | None = None,
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
        # we special case superuser so that if they're a member of the org
        # they must still follow SSO checks, but they gain global access
        try:
            member = get_cached_organization_member(request.user.id, organization.id)
        except OrganizationMember.DoesNotExist:
            sso_state = _SSO_BYPASS
        else:
            sso_state = _sso_params(member)

        return OrganizationGlobalAccess(
            organization=organization,
            _member=member,
            scopes=scopes if scopes is not None else settings.SENTRY_SCOPES,
            _sso_state=sso_state,
            permissions=get_permissions_for_user(request.user.id),
        )

    if hasattr(request, "auth") and not request.user.is_authenticated:
        return from_auth(request.auth, organization)

    return from_user(request.user, organization, scopes=scopes)


# only used internally
def _from_sentry_app(
    user: User | AnonymousUser, organization: Organization | None = None
) -> Access:
    if not organization:
        return NoAccess()

    sentry_app_query = SentryApp.objects.filter(proxy_user=user)

    if not sentry_app_query.exists():
        return NoAccess()

    sentry_app = sentry_app_query.first()

    if not sentry_app.is_installed_on(organization):
        return NoAccess()

    return OrganizationGlobalMembership(organization, sentry_app.scope_list, _sso_state=_SSO_BYPASS)


def from_user(
    user: User | AnonymousUser,
    organization: Organization | None = None,
    scopes: Iterable[str] | None = None,
    is_superuser: bool = False,
) -> Access:
    if not user or user.is_anonymous or not user.is_active:
        return DEFAULT

    def organizationless() -> Access:
        return OrganizationlessAccess(
            permissions=get_permissions_for_user(user.id) if is_superuser else frozenset()
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
    scopes: Iterable[str] | None = None,
    is_superuser: bool = False,
) -> Access:
    if scopes is not None:
        scope_intersection = frozenset(scopes) & member.get_scopes()
    else:
        scope_intersection = member.get_scopes()

    permissions = get_permissions_for_user(member.user_id) if is_superuser else frozenset()

    return OrganizationMemberAccess(member, scope_intersection, permissions)


def from_auth(auth: ApiKey | SystemToken, organization: Organization) -> Access:
    if is_system_auth(auth):
        return SystemAccess()
    if auth.organization_id == organization.id:
        return OrganizationGlobalAccess(
            auth.organization, settings.SENTRY_SCOPES, _sso_state=_SSO_BYPASS
        )
    else:
        return DEFAULT


DEFAULT = NoAccess()
