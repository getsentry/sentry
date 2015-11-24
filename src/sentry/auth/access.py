from __future__ import absolute_import

__all__ = ['from_user', 'from_member', 'DEFAULT']

from django.conf import settings

from sentry.models import AuthIdentity, AuthProvider, OrganizationMember


class BaseAccess(object):
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
        return team in self.teams

    def has_team_scope(self, team, scope):
        return self.has_team(team) and self.has_scope(scope)

    def to_django_context(self):
        return {
            s.replace(':', '_'): self.has_scope(s)
            for s in settings.SENTRY_SCOPES
        }


class Access(BaseAccess):
    # TODO(dcramer): this is still a little gross, and ideally backend access
    # would be based on the same scopes as API access so theres clarity in
    # what things mean
    def __init__(self, scopes, is_active, teams, sso_is_valid):
        self.teams = teams
        self.scopes = scopes

        self.is_active = is_active
        self.sso_is_valid = sso_is_valid


def from_request(request, organization):
    if not organization:
        return DEFAULT

    if request.is_superuser():
        return Access(
            scopes=settings.SENTRY_SCOPES,
            is_active=True,
            teams=organization.team_set.all(),
            sso_is_valid=True,
        )
    return from_user(request.user, organization)


def from_user(user, organization):
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

    return from_member(om)


def from_member(member):
    # TODO(dcramer): we want to optimize this access pattern as its several
    # network hops and needed in a lot of places
    try:
        auth_provider = AuthProvider.objects.get(
            organization=member.organization_id,
        )
    except AuthProvider.DoesNotExist:
        sso_is_valid = True
    else:
        if auth_provider.flags.allow_unlinked:
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
        is_active=True,
        sso_is_valid=sso_is_valid,
        scopes=member.get_scopes(),
        teams=member.get_teams(),
    )


class NoAccess(BaseAccess):
    @property
    def sso_is_valid(self):
        return True

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
