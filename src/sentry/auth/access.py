from __future__ import absolute_import

__all__ = ['from_user', 'from_member', 'DEFAULT']

import warnings

from django.conf import settings

from sentry.models import AuthIdentity, AuthProvider, OrganizationMember


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

    def has_scope(self, scope):
        if not self.is_active:
            return False
        return scope in self.scopes

    def has_team(self, team):
        warnings.warn('has_team() is deprecated in favor of has_team_access',
                      DeprecationWarning)
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
        return {
            s.replace(':', '_'): self.has_scope(s)
            for s in settings.SENTRY_SCOPES
        }


class Access(BaseAccess):
    # TODO(dcramer): this is still a little gross, and ideally backend access
    # would be based on the same scopes as API access so theres clarity in
    # what things mean
    def __init__(self, scopes, is_active, teams, memberships, sso_is_valid,
                 requires_sso):
        self.teams = teams
        self.memberships = memberships
        self.scopes = scopes

        self.is_active = is_active
        self.sso_is_valid = sso_is_valid
        self.requires_sso = requires_sso


def from_request(request, organization, scopes=None):
    if not organization:
        return DEFAULT

    if request.is_superuser():
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
        )
    return from_user(request.user, organization, scopes=scopes)


def from_user(user, organization, scopes=None):
    if not organization:
        return DEFAULT

    if user.is_anonymous():
        return DEFAULT

    try:
        om = OrganizationMember.objects.get(
            user=user,
            organization=organization,
        )
    except OrganizationMember.DoesNotExist:
        return DEFAULT

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
    )


class NoAccess(BaseAccess):
    requires_sso = False
    sso_is_valid = True
    is_active = False
    teams = ()
    memberships = ()
    scopes = frozenset()

DEFAULT = NoAccess()
