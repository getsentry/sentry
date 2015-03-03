from __future__ import absolute_import

__all__ = ['from_user', 'from_member', 'DEFAULT', 'SCOPES']

from sentry.models import AuthIdentity, AuthProvider, OrganizationMember

SCOPES = set([
    'org:read',
    'org:write',
    'org:delete',
    'team:read',
    'team:write',
    'team:delete',
    'project:read',
    'project:write',
    'project:delete',
    'event:read',
    'event:write',
    'event:delete',
])


class BaseAccess(object):
    is_global = False
    is_active = False
    sso_is_valid = False
    teams = ()
    scopes = frozenset()

    def has_scope(self, scope):
        if not self.is_active:
            return False
        return scope in self.scopes

    def has_team(self, team):
        if not self.is_active:
            return False
        if self.is_global:
            return True
        return team in self.teams

    def to_django_context(self):
        return {s.replace(':', '_'): self.has_scope(s) for s in SCOPES}


class Access(BaseAccess):
    # TODO(dcramer): this is still a little gross, and ideally backend access
    # would be based on the same scopes as API access so theres clarity in
    # what things mean
    def __init__(self, scopes, is_global, is_active, teams, sso_is_valid):
        self.teams = teams
        self.scopes = scopes

        self.is_global = is_global
        self.is_active = is_active
        self.sso_is_valid = sso_is_valid


def from_user(user, organization):
    if user.is_superuser:
        return Access(
            scopes=SCOPES,
            is_global=True,
            is_active=True,
            teams=(),
            sso_is_valid=True,
        )

    if not organization:
        return DEFAULT

    try:
        om = OrganizationMember.objects.get(
            user=user,
            organization=organization,
        )
    except OrganizationMember.DoesNotExist:
        return DEFAULT

    return from_member(om)


def from_member(member):
    # TODO(dcramer): we want to optimize this access pattern as its several
    # network hops and needed in a lot of places
    if member.has_global_access:
        teams = ()
    else:
        teams = member.teams.all()

    try:
        auth_provider = AuthProvider.objects.get(
            organization=member.organization_id,
        )
    except AuthProvider.DoesNotExist:
        sso_is_valid = True
    else:
        try:
            auth_identity = AuthIdentity.objects.get(
                auth_provider=auth_provider,
                user=member.user_id,
            )
        except AuthIdentity.DoesNotExist:
            sso_is_valid = False
        else:
            sso_is_valid = auth_identity.is_valid(member)

    return Access(
        is_global=member.has_global_access,
        is_active=True,
        sso_is_valid=sso_is_valid,
        scopes=member.scopes,
        teams=teams,
    )


class NoAccess(BaseAccess):
    @property
    def sso_is_valid(self):
        return True

    @property
    def is_global(self):
        return False

    @property
    def is_active(self):
        return False

    @property
    def teams(self):
        return ()

    @property
    def scopes(self):
        return frozenset()

DEFAULT = NoAccess()
