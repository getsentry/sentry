from __future__ import absolute_import

__all__ = ['from_user', 'from_member', 'DEFAULT']

import warnings

from django.conf import settings
from django.utils.functional import cached_property

from sentry import roles
from sentry.auth.superuser import is_active_superuser
from sentry.models import (
    AuthIdentity, AuthProvider, OrganizationMember, SentryApp, UserPermission
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
    # teams with valid access
    teams = ()
    # teams with valid membership
    memberships = ()
    scopes = frozenset()
    permissions = frozenset()

    def has_permission(self, permission):
        if not self.is_active:
            return False
        return permission in self.permissions

    def has_scope(self, scope):
        if not self.is_active:
            return False
        return scope in self.scopes

    def has_team(self, team):
        warnings.warn('has_team() is deprecated in favor of has_team_access', DeprecationWarning)
        return self.has_team_access(team)

    def has_team_access(self, team):
        if not self.is_active:
            return False
        return team in self.teams

    def has_team_membership(self, team):
        if not self.is_active:
            return False
        return team in self.memberships

    def has_team_scope(self, team, scope):
        return self.has_team_access(team) and self.has_scope(scope)

    def to_django_context(self):
        return {s.replace(':', '_'): self.has_scope(s) for s in settings.SENTRY_SCOPES}


class Access(BaseAccess):
    # TODO(dcramer): this is still a little gross, and ideally backend access
    # would be based on the same scopes as API access so theres clarity in
    # what things mean
    def __init__(self, scopes, is_active, teams, memberships,
                 sso_is_valid, requires_sso, permissions=None):
        self.teams = teams
        self.memberships = memberships
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
    memberships = ()
    permissions = frozenset()

    def __init__(self, organization, scopes=None):
        if scopes:
            self.scopes = scopes
        self.organization = organization

    @cached_property
    def scopes(self):
        return settings.SENTRY_SCOPES

    @cached_property
    def teams(self):
        from sentry.models import Team
        return list(Team.objects.filter(organization=self.organization))

    def has_team_access(self, team):
        return team.organization_id == self.organization.id

    def has_team_membership(self, team):
        return team.organization_id == self.organization.id

    def has_team_scope(self, team, scope):
        return team.organization_id == self.organization.id

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
    teams = ()
    memberships = ()
    scopes = frozenset()
    permissions = frozenset()


def from_request(request, organization=None, scopes=None):
    if not organization:
        return from_user(request.user,
                         organization=organization,
                         scopes=scopes)

    if request.user.is_sentry_app:
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

        team_list = list(organization.team_set.all())
        return Access(
            scopes=scopes if scopes is not None else settings.SENTRY_SCOPES,
            is_active=True,
            teams=team_list,
            memberships=team_list,
            sso_is_valid=sso_is_valid,
            requires_sso=requires_sso,
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

    return Access(
        scopes=sentry_app.scope_list,
        is_active=True,
        teams=list(sentry_app.teams.all()),
        memberships=(),
        permissions=(),
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

    team_memberships = member.get_teams()
    if member.organization.flags.allow_joinleave:
        team_access = list(member.organization.team_set.all())
    else:
        team_access = team_memberships

    if scopes is not None:
        scopes = set(scopes) & member.get_scopes()
    else:
        scopes = member.get_scopes()

    return Access(
        is_active=True,
        requires_sso=requires_sso,
        sso_is_valid=sso_is_valid,
        scopes=scopes,
        memberships=team_memberships,
        teams=team_access,
        permissions=UserPermission.for_user(member.user_id),
    )


def from_auth(auth, scopes=None):
    return OrganizationGlobalAccess(auth.organization, scopes=scopes)


DEFAULT = NoAccess()
