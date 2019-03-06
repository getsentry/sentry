from __future__ import absolute_import

__all__ = ['from_user', 'from_member', 'DEFAULT']

import warnings

from django.conf import settings
from django.utils.functional import cached_property

from sentry import roles
from sentry.auth.superuser import is_active_superuser
from sentry.models import (
    AuthIdentity, AuthProvider, OrganizationMember, Project, SentryApp, UserPermission
)


def _sso_params(member):
    """
    Return a tuple of (requires_sso, sso_is_valid) for a given member.
    """
    # TODO(dcramer): we want to optimize this access pattern as its several
    # network hops and needed in a lot of places
    try:
        auth_provider = AuthProvider.objects.get(
            organization=member.organization_id,
        )
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
                    auth_provider=auth_provider,
                    user=member.user_id,
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
                        ).exclude(id=member.id).values_list('user_id')
                    ).exists()
            else:
                sso_is_valid = auth_identity.is_valid(member)
    return requires_sso, sso_is_valid


class BaseAccess(object):
    is_active = False
    sso_is_valid = False
    requires_sso = False
    organization_id = None
    # teams with membership
    teams = ()
    # projects with membership
    projects = ()
    # if open access policy is specified, then any project
    # matching organization_id is valid
    open_access_policy = False
    scopes = frozenset()
    permissions = frozenset()

    def has_permission(self, permission):
        """
        Return bool representing if the user has the given permission.

        >>> access.has_permission('broadcasts.admin')
        """
        if not self.is_active:
            return False
        return permission in self.permissions

    def has_scope(self, scope):
        """
        Return bool representing if the user has the given scope.

        >>> access.has_project('org:read')
        """
        if not self.is_active:
            return False
        return scope in self.scopes

    def has_team(self, team):
        warnings.warn('has_team() is deprecated in favor of has_team_access', DeprecationWarning)
        return self.has_team_access(team)

    def has_team_access(self, team):
        """
        Return bool representing if a user should have access to information for the given team.

        >>> access.has_team_access(team)
        """
        if not self.is_active:
            return False
        if self.open_access_policy and self.organization_id == team.organization_id:
            return True
        return team in self.teams

    def has_team_scope(self, team, scope):
        """
        Return bool representing if a user should have access with the given scope to information
        for the given team.

        >>> access.has_team_scope(team, 'team:read')
        """
        return self.has_team_access(team) and self.has_scope(scope)

    def has_project_access(self, project):
        """
        Return bool representing if a user should have access to information for the given project.

        >>> access.has_project_access(project)
        """
        if not self.is_active:
            return False
        if self.open_access_policy and self.organization_id == project.organization_id:
            return True
        return project in self.projects

    def has_projects_access(self, projects):
        """
        Returns bool representing if a user should have access to every requested project
        """
        return all([self.has_project_access(project) for project in projects])

    def has_project_membership(self, project):
        """
        Return bool representing if a user has explicit membership for the given project.

        >>> access.has_project_membership(project)
        """
        if not self.is_active:
            return False
        return project in self.projects

    def has_project_scope(self, project, scope):
        """
        Return bool representing if a user should have access with the given scope to information
        for the given project.

        >>> access.has_project_scope(project, 'project:read')
        """
        return self.has_project_access(project) and self.has_scope(scope)

    def to_django_context(self):
        return {s.replace(':', '_'): self.has_scope(s) for s in settings.SENTRY_SCOPES}


class Access(BaseAccess):
    # TODO(dcramer): this is still a little gross, and ideally backend access
    # would be based on the same scopes as API access so theres clarity in
    # what things mean
    def __init__(self, scopes, is_active, organization_id, teams, projects, open_access_policy,
                 sso_is_valid, requires_sso, permissions=None):
        self.organization_id = organization_id
        self.teams = teams
        self.projects = projects
        self.open_access_policy = open_access_policy
        self.scopes = scopes
        if permissions is not None:
            self.permissions = permissions

        self.is_active = is_active
        self.sso_is_valid = sso_is_valid
        self.requires_sso = requires_sso


class OrganizationGlobalAccess(BaseAccess):
    requires_sso = False
    sso_is_valid = True
    is_active = True
    open_access_policy = True
    teams = ()
    projects = ()
    permissions = frozenset()

    def __init__(self, organization, scopes=None):
        if scopes:
            self.scopes = scopes
        self.organization_id = organization.id

    @cached_property
    def scopes(self):
        return settings.SENTRY_SCOPES

    def has_team_access(self, team):
        return team.organization_id == self.organization_id

    def has_project_access(self, project):
        return project.organization_id == self.organization_id

    def has_scope(self, scope):
        return True


class OrganizationlessAccess(BaseAccess):
    is_active = True

    def __init__(self, permissions=None):
        if permissions is not None:
            self.permissions = permissions


class NoAccess(BaseAccess):
    requires_sso = False
    sso_is_valid = True
    is_active = False
    organization_id = None
    open_access_policy = False
    teams = ()
    projects = ()
    memberships = ()
    scopes = frozenset()
    permissions = frozenset()


def from_request(request, organization=None, scopes=None):
    if not organization:
        return from_user(request.user,
                         organization=organization,
                         scopes=scopes)

    if getattr(request.user, 'is_sentry_app', False):
        return from_sentry_app(request.user, organization=organization)

    if is_active_superuser(request):
        # we special case superuser so that if they're a member of the org
        # they must still follow SSO checks, but they gain global access
        try:
            member = OrganizationMember.objects.get(
                user=request.user,
                organization=organization,
            )
        except OrganizationMember.DoesNotExist:
            requires_sso, sso_is_valid = False, True
        else:
            requires_sso, sso_is_valid = _sso_params(member)

        team_list = ()

        project_list = ()
        return Access(
            scopes=scopes if scopes is not None else settings.SENTRY_SCOPES,
            is_active=True,
            organization_id=organization.id if organization else None,
            teams=team_list,
            projects=project_list,
            sso_is_valid=sso_is_valid,
            requires_sso=requires_sso,
            open_access_policy=True,
            permissions=UserPermission.for_user(request.user.id),
        )

    if hasattr(request, 'auth') and not request.user.is_authenticated():
        return from_auth(request.auth, scopes=scopes)

    return from_user(request.user, organization, scopes=scopes)


def from_sentry_app(user, organization=None):
    if not organization:
        return NoAccess()

    sentry_app = SentryApp.objects.get(proxy_user=user)

    if not sentry_app.is_installed_on(organization):
        return NoAccess()

    team_list = list(sentry_app.teams.all())
    project_list = list(Project.objects.filter(
        teams__in=team_list,
    ))

    return Access(
        scopes=sentry_app.scope_list,
        is_active=True,
        organization_id=organization.id if organization else None,
        teams=team_list,
        projects=project_list,
        permissions=(),
        open_access_policy=False,
        sso_is_valid=True,
        requires_sso=False,
    )


def from_user(user, organization=None, scopes=None):
    if not user or user.is_anonymous() or not user.is_active:
        return DEFAULT

    if not organization:
        return OrganizationlessAccess(
            permissions=UserPermission.for_user(user.id),
        )

    try:
        om = OrganizationMember.objects.get(
            user=user,
            organization=organization,
        )
    except OrganizationMember.DoesNotExist:
        return OrganizationlessAccess(
            permissions=UserPermission.for_user(user.id),
        )

    # ensure cached relation
    om.organization = organization

    return from_member(om, scopes=scopes)


def from_member(member, scopes=None):
    # TODO(dcramer): we want to optimize this access pattern as its several
    # network hops and needed in a lot of places
    requires_sso, sso_is_valid = _sso_params(member)

    team_list = member.get_teams()
    project_list = list(Project.objects.filter(teams__in=team_list))

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
        teams=team_list,
        projects=project_list,
        open_access_policy=bool(member.organization.flags.allow_joinleave),
        permissions=UserPermission.for_user(member.user_id),
    )


def from_auth(auth, scopes=None):
    return OrganizationGlobalAccess(auth.organization, scopes=scopes)


DEFAULT = NoAccess()
