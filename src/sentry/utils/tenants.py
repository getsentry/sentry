from __future__ import absolute_import

from sentry.app import env
from sentry.utils.cache import memoize


class Tenant(object):
    def __init__(self, user_id=None, organization_ids=None):
        self.user_id = user_id

    @classmethod
    def from_user(cls, user):
        if not user:
            return cls()

        return cls(
            user_id=user.id,
        )

    @memoize
    def organization_ids(self):
        from sentry.models import OrganizationMember
        if not self.user_id:
            return []
        return list(OrganizationMember.objects.filter(
            user=self.user_id,
        ).values_list('organization', flat=True))

    @memoize
    def team_ids(self):
        from sentry.models import OrganizationMemberTeam
        if not self.user_id:
            return []
        return list(OrganizationMemberTeam.objects.filter(
            user=self.user_id,
        ).values_list('team', flat=True))

    @memoize
    def project_ids(self):
        from sentry.models import Project
        if not self.user_id:
            return []
        return list(Project.objects.filter(
            team__in=self.team_ids,
        ).values_list('id', flat=True))


def get_current_user():
    if not env.request:
        return None
    return env.request.user


def get_tenant_from_request():
    user = get_current_user()
    return Tenant.from_user(user)


def get_current_tenant():
    rv = getattr(env, 'tenant', None)
    if rv is None:
        rv = get_tenant_from_request()
        env.tenant = rv
    return rv


def set_current_tenant(tenant):
    env.tenant = tenant
