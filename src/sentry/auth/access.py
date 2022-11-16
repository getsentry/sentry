from __future__ import annotations

__all__ = [
    "from_user",
    "from_member",
    "DEFAULT",
    "from_user_and_api_user_org_context",
    "from_api_member",
]

import abc
from dataclasses import dataclass
from functools import cached_property
from typing import Any, Collection, FrozenSet, Iterable, Mapping, cast

import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser

from sentry import features, roles
from sentry.auth.superuser import is_active_superuser
from sentry.auth.system import SystemToken, is_system_auth
from sentry.models import (
    ApiKey,
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
from sentry.services.hybrid_cloud.app import app_service
from sentry.services.hybrid_cloud.auth import ApiAuthState, ApiMemberSsoState, auth_service
from sentry.services.hybrid_cloud.organization import ApiTeamMember, ApiUserOrganizationContext
from sentry.services.hybrid_cloud.user import APIUser
from sentry.utils import metrics
from sentry.utils.request_cache import request_cache


@request_cache
def get_cached_organization_member(user_id: int, organization_id: int) -> OrganizationMember:
    return OrganizationMember.objects.get(user_id=user_id, organization_id=organization_id)


def get_permissions_for_user(user_id: int) -> FrozenSet[str]:
    union = UserRole.permissions_for_user(user_id) | UserPermission.for_user(user_id)
    return cast(FrozenSet[str], union)


class Access(abc.ABC):
    @property
    @abc.abstractmethod
    def sso_is_valid(self) -> bool:
        pass

    @property
    @abc.abstractmethod
    def requires_sso(self) -> bool:
        pass

    @property
    @abc.abstractmethod
    def has_global_access(self) -> bool:
        pass

    @property
    @abc.abstractmethod
    def scopes(self) -> FrozenSet[str]:
        pass

    @property
    @abc.abstractmethod
    def permissions(self) -> FrozenSet[str]:
        pass

    @property
    @abc.abstractmethod
    def role(self) -> str | None:
        pass

    @property
    @abc.abstractmethod
    def team_ids_with_membership(self) -> FrozenSet[int]:
        pass

    @property
    @abc.abstractmethod
    def accessible_team_ids(self) -> FrozenSet[int]:
        pass

    @property
    @abc.abstractmethod
    def project_ids_with_team_membership(self) -> FrozenSet[int]:
        pass

    @property
    @abc.abstractmethod
    def accessible_project_ids(self) -> FrozenSet[int]:
        pass

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
        if self.role is not None:
            return cast(OrganizationRole, organization_roles.get(self.role))
        return None

    @abc.abstractmethod
    def has_team_access(self, team: Team) -> bool:
        """
        Return bool representing if a user should have access to information for the given team.
        >>> access.has_team_access(team)
        """
        pass

    @abc.abstractmethod
    def has_team_scope(self, team: Team, scope: str) -> bool:
        pass

    def has_team_membership(self, team: Team) -> bool:
        return team.id in self.team_ids_with_membership

    @abc.abstractmethod
    def get_team_role(self, team: Team) -> TeamRole | None:
        pass

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

    @abc.abstractmethod
    def has_any_project_scope(self, project: Project, scopes: Collection[str]) -> bool:
        pass

    def to_django_context(self) -> Mapping[str, bool]:
        return {s.replace(":", "_"): self.has_scope(s) for s in settings.SENTRY_SCOPES}


@dataclass
class DbAccess(Access):
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

    def get_team_role(self, team: Team) -> TeamRole | None:
        team_member = self._team_memberships.get(team)
        return team_member and team_member.get_team_role()

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


@dataclass
class ApiBackedAccess(Access):
    api_user_organization_context: ApiUserOrganizationContext
    requested_scopes: Iterable[str] | None
    auth_state: ApiAuthState

    @cached_property
    def permissions(self) -> FrozenSet[str]:
        return frozenset(self.auth_state.permissions)

    @property
    def sso_is_valid(self) -> bool:
        return self.auth_state.sso_state.is_valid

    @property
    def requires_sso(self) -> bool:
        return self.auth_state.sso_state.is_required

    @property
    def has_global_access(self) -> bool:
        if self.api_user_organization_context.organization.flags.allow_joinleave:
            return True

        if (
            self.api_user_organization_context.member
            and roles.get(self.api_user_organization_context.member.role).is_global
        ):
            return True

        return False

    @cached_property
    def scopes(self) -> FrozenSet[str]:
        if self.api_user_organization_context.member is None:
            return frozenset(self.requested_scopes or [])

        if self.requested_scopes is None:
            return frozenset(self.api_user_organization_context.member.scopes)

        return frozenset(self.api_user_organization_context.member.scopes) & frozenset(
            self.requested_scopes
        )

    @property
    def role(self) -> str | None:
        if self.api_user_organization_context.member is None:
            return None
        return self.api_user_organization_context.member.role

    @cached_property
    def team_ids_with_membership(self) -> FrozenSet[int]:
        if self.api_user_organization_context.member is None:
            return frozenset()
        return frozenset(
            mt.team_id for mt in self.api_user_organization_context.member.member_teams
        )

    @cached_property
    def accessible_team_ids(self) -> FrozenSet[int]:
        return self.team_ids_with_membership

    @cached_property
    def project_ids_with_team_membership(self) -> FrozenSet[int]:
        if self.api_user_organization_context.member is None:
            return frozenset()
        return frozenset(self.api_user_organization_context.member.project_ids)

    @cached_property
    def accessible_project_ids(self) -> FrozenSet[int]:
        return self.project_ids_with_team_membership

    def has_team_access(self, team: Team) -> bool:
        if team.status != TeamStatus.VISIBLE:
            return False
        if (
            self.has_global_access
            and self.api_user_organization_context.organization.id == team.organization_id
        ):
            return True
        return team.id in self.team_ids_with_membership

    def _get_team_membership(self, team_id: int) -> ApiTeamMember | None:
        if self.api_user_organization_context.member is None:
            return None

        for team_membership in self.api_user_organization_context.member.member_teams:
            if team_membership.team_id == team_id:
                return team_membership
        return None

    def has_team_scope(self, team: Team, scope: str) -> bool:
        if not self.has_team_access(team):
            return False
        if self.has_scope(scope):
            return True

        if self.api_user_organization_context.member is None:
            return False

        team_membership = self._get_team_membership(team.id)

        if team_membership and scope in team_membership.scopes:
            metrics.incr(
                "team_roles.pass_by_team_scope",
                tags={"team_role": f"{team_membership.role}", "scope": scope},
            )
            return True

        return False

    def get_team_role(self, team: Team) -> TeamRole | None:
        team_member = self._get_team_membership(team.id)
        if team_member:
            return team_member.role
        return None

    def has_project_access(self, project: Project) -> bool:
        if project.status != ProjectStatus.VISIBLE:
            return False
        if (
            self.has_global_access
            and self.api_user_organization_context.member
            and self.api_user_organization_context.organization.id == project.organization_id
        ):
            return True
        return project.id in self.project_ids_with_team_membership

    def has_any_project_scope(self, project: Project, scopes: Collection[str]) -> bool:
        if not self.has_project_access(project):
            return False

        if any(self.has_scope(scope) for scope in scopes):
            return True

        if self.api_user_organization_context.member and features.has(
            "organizations:team-roles", self.api_user_organization_context.organization.id
        ):
            memberships = self.api_user_organization_context.member.member_teams
            for membership in memberships:
                team_scopes = membership.scopes
                for scope in scopes:
                    if scope in team_scopes:
                        metrics.incr(
                            "team_roles.pass_by_project_scope",
                            tags={"team_role": f"{membership.role}", "scope": scope},
                        )
                        return True

        return False


class OrganizationMemberAccess(DbAccess):
    def __init__(
        self, member: OrganizationMember, scopes: Iterable[str], permissions: Iterable[str]
    ) -> None:
        auth_state = auth_service.get_user_auth_state(
            organization_id=member.organization_id,
            is_superuser=False,
            org_member=member,
            user_id=member.user_id,
        )
        sso_state = auth_state.sso_state
        has_global_access = (
            bool(member.organization.flags.allow_joinleave) or roles.get(member.role).is_global
        )

        super().__init__(
            _member=member,
            sso_is_valid=sso_state.is_valid,
            requires_sso=sso_state.is_required,
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


class OrganizationGlobalAccess(DbAccess):
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


class ApiBackedOrganizationGlobalAccess(ApiBackedAccess):
    """Access to all an organization's teams and projects."""

    def __init__(
        self,
        *,
        api_user_organization_context: ApiUserOrganizationContext,
        auth_state: ApiAuthState,
        scopes: Iterable[str] | None,
    ):
        super().__init__(
            api_user_organization_context=api_user_organization_context,
            auth_state=auth_state,
            requested_scopes=scopes,
        )

    @cached_property
    def scopes(self) -> FrozenSet[str]:
        return frozenset(self.requested_scopes or [])

    @property
    def has_global_access(self) -> bool:
        return True

    def has_team_access(self, team: Team) -> bool:
        return bool(
            team.organization_id == self.api_user_organization_context.organization.id
            and team.status == TeamStatus.VISIBLE
        )

    def has_project_access(self, project: Project) -> bool:
        return bool(
            project.organization_id == self.api_user_organization_context.organization.id
            and project.status == ProjectStatus.VISIBLE
        )

    @cached_property
    def accessible_team_ids(self) -> FrozenSet[int]:
        return frozenset(
            t.id
            for t in self.api_user_organization_context.organization.teams
            if t.status == TeamStatus.VISIBLE
        )

    @cached_property
    def accessible_project_ids(self) -> FrozenSet[int]:
        return frozenset(
            p.id
            for p in self.api_user_organization_context.organization.projects
            if p.status == ProjectStatus.VISIBLE
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


class ApiOrganizationGlobalMembership(ApiBackedOrganizationGlobalAccess):
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


@dataclass
class OrganizationlessAccess(Access):
    auth_state: ApiAuthState

    @cached_property
    def permissions(self) -> FrozenSet[str]:
        return frozenset(self.auth_state.permissions)

    def has_team_access(self, team: Team) -> bool:
        return False

    def has_project_access(self, project: Project) -> bool:
        return False

    @property
    def sso_is_valid(self) -> bool:
        return self.auth_state.sso_state.is_valid

    @property
    def requires_sso(self) -> bool:
        return self.auth_state.sso_state.is_required

    @property
    def has_global_access(self) -> bool:
        return False

    @property
    def scopes(self) -> FrozenSet[str]:
        return frozenset()

    @property
    def role(self) -> str | None:
        return None

    @property
    def team_ids_with_membership(self) -> FrozenSet[int]:
        return frozenset()

    @property
    def accessible_team_ids(self) -> FrozenSet[int]:
        return frozenset()

    @property
    def project_ids_with_team_membership(self) -> FrozenSet[int]:
        return frozenset()

    @property
    def accessible_project_ids(self) -> FrozenSet[int]:
        return frozenset()

    def has_team_scope(self, team: Team, scope: str) -> bool:
        return False

    def get_team_role(self, team: Team) -> TeamRole | None:
        return None

    def has_any_project_scope(self, project: Project, scopes: Collection[str]) -> bool:
        if not self.has_project_access(project):
            return False

        return any(self.has_scope(scope) for scope in scopes)


class SystemAccess(OrganizationlessAccess):
    def __init__(self) -> None:
        super().__init__(
            auth_state=ApiAuthState(
                sso_state=ApiMemberSsoState(False, False),
                permissions=[],
            ),
        )

    def has_global_access(self) -> bool:
        return True

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
        return frozenset()

    @property
    def accessible_project_ids(self) -> FrozenSet[int]:
        return frozenset()


class NoAccess(OrganizationlessAccess):
    def __init__(self) -> None:
        super().__init__(
            auth_state=ApiAuthState(
                sso_state=ApiMemberSsoState(is_required=False, is_valid=True),
                permissions=[],
            ),
        )


def from_request_org_and_scopes(
    *,
    request: Any,
    api_user_org_context: ApiUserOrganizationContext | None = None,
    scopes: Iterable[str] | None = None,
) -> Access:
    is_superuser = is_active_superuser(request)
    if not api_user_org_context:
        return from_user_and_api_user_org_context(
            user=request.user,
            api_user_org_context=api_user_org_context,
            is_superuser=is_superuser,
            scopes=scopes,
        )

    if getattr(request.user, "is_sentry_app", False):
        return _from_api_sentry_app(api_user_org_context)

    if is_superuser:
        member = api_user_org_context.member
        auth_state = auth_service.get_user_auth_state(
            user_id=request.user.id,
            organization_id=api_user_org_context.organization.id,
            is_superuser=is_superuser,
            org_member=member,
        )

        return ApiBackedOrganizationGlobalAccess(
            api_user_organization_context=api_user_org_context,
            auth_state=auth_state,
            scopes=scopes if scopes is not None else settings.SENTRY_SCOPES,
        )

    if hasattr(request, "auth") and not request.user.is_authenticated:
        return from_api_auth(request.auth, api_user_org_context)

    return from_user_and_api_user_org_context(
        user=request.user,
        api_user_org_context=api_user_org_context,
        is_superuser=False,
        scopes=scopes,
    )


def organizationless_access(user: User | APIUser | AnonymousUser, is_superuser: bool) -> Access:
    return OrganizationlessAccess(
        auth_state=auth_service.get_user_auth_state(
            user_id=user.id,
            is_superuser=is_superuser,
            organization_id=None,
            org_member=None,
        )
    )


def normalize_valid_user(user: User | APIUser | AnonymousUser | None) -> User | APIUser | None:
    if not user or user.is_anonymous or not user.is_active:
        return None
    return user


def from_user_and_api_user_org_context(
    *,
    user: User | APIUser | None,
    api_user_org_context: ApiUserOrganizationContext | None = None,
    is_superuser: bool = False,
    scopes: Iterable[str] | None = None,
    auth_state: ApiAuthState | None = None,
) -> Access:
    if (user := normalize_valid_user(user)) is None:
        return DEFAULT

    if not api_user_org_context or not api_user_org_context.member:
        return organizationless_access(user, is_superuser)

    return from_api_member(
        api_user_organization_context=api_user_org_context,
        scopes=scopes,
        is_superuser=is_superuser,
        auth_state=auth_state,
    )


def from_request(
    request: Any, organization: Organization = None, scopes: Iterable[str] | None = None
) -> Access:
    is_superuser = is_active_superuser(request)

    if not organization:
        return from_user(
            request.user, organization=organization, scopes=scopes, is_superuser=is_superuser
        )

    if getattr(request.user, "is_sentry_app", False):
        return _from_sentry_app(request.user, organization=organization)

    if is_superuser:
        member: OrganizationMember | None = None
        try:
            member = get_cached_organization_member(request.user.id, organization.id)
        except OrganizationMember.DoesNotExist:
            pass
        sso_state = auth_service.get_user_auth_state(
            user_id=request.user.id,
            organization_id=organization.id,
            is_superuser=is_superuser,
            org_member=member,
        ).sso_state

        return OrganizationGlobalAccess(
            organization=organization,
            _member=member,
            scopes=scopes if scopes is not None else settings.SENTRY_SCOPES,
            sso_is_valid=sso_state.is_valid,
            requires_sso=sso_state.is_required,
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

    return OrganizationGlobalMembership(organization, sentry_app.scope_list, sso_is_valid=True)


def _from_api_sentry_app(context: ApiUserOrganizationContext | None = None) -> Access:
    if not context or context.user_id is None:
        return NoAccess()

    installation = app_service.find_installation_by_proxy_user(
        proxy_user_id=context.user_id, organization_id=context.organization.id
    )
    if installation is None:
        return NoAccess()

    return ApiOrganizationGlobalMembership(
        api_user_organization_context=context,
        auth_state=ApiAuthState(
            sso_state=ApiMemberSsoState(
                is_valid=True,
                is_required=False,
            ),
            permissions=[],
        ),
        scopes=installation.sentry_app.scope_list,
    )


def from_user(
    user: User | APIUser | AnonymousUser | None,
    organization: Organization | None = None,
    scopes: Iterable[str] | None = None,
    is_superuser: bool = False,
) -> Access:
    if (user := normalize_valid_user(user)) is None:
        return DEFAULT

    if not organization:
        return organizationless_access(user, is_superuser)

    try:
        om = get_cached_organization_member(user.id, organization.id)
    except OrganizationMember.DoesNotExist:
        return organizationless_access(user, is_superuser)

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


def from_api_member(
    api_user_organization_context: ApiUserOrganizationContext,
    scopes: Iterable[str] | None = None,
    is_superuser: bool = False,
    auth_state: ApiAuthState | None = None,
) -> Access:
    if api_user_organization_context.user_id is None:
        return DEFAULT

    return ApiBackedAccess(
        api_user_organization_context=api_user_organization_context,
        requested_scopes=scopes,
        auth_state=auth_state
        or auth_service.get_user_auth_state(
            user_id=api_user_organization_context.user_id,
            organization_id=api_user_organization_context.organization.id,
            is_superuser=is_superuser,
            org_member=api_user_organization_context.member,
        ),
    )


def from_auth(auth: ApiKey | SystemToken, organization: Organization) -> Access:
    if is_system_auth(auth):
        return SystemAccess()
    if auth.organization_id == organization.id:
        return OrganizationGlobalAccess(
            auth.organization, settings.SENTRY_SCOPES, sso_is_valid=True
        )
    else:
        return DEFAULT


def from_api_auth(
    auth: ApiKey | SystemToken, api_user_org_context: ApiUserOrganizationContext
) -> Access:
    if is_system_auth(auth):
        return SystemAccess()
    if auth.organization_id == api_user_org_context.organization.id:
        return ApiBackedOrganizationGlobalAccess(
            api_user_organization_context=api_user_org_context,
            auth_state=ApiAuthState(
                permissions=[],
                sso_state=ApiMemberSsoState(
                    is_valid=True,
                    is_required=False,
                ),
            ),
            scopes=settings.SENTRY_SCOPES,
        )
    else:
        return DEFAULT


DEFAULT = NoAccess()
