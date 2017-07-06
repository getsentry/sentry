from __future__ import absolute_import

from sentry.app import env
from sentry.utils.cache import memoize


ALL = object()


class Tenant(object):
    def __init__(self, user_id=None):
        self.user_id = user_id

    def __repr__(self):
        return '<{} user_id={}>'.format(type(self).__name__, self.user_id)

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


class UnrestrictedTenant(object):
    """
    An omnipotent tenant which has no restrictions on queries. This i
    useful in async process or other always-actor-less code paths.
    """
    organization_ids = ALL
    team_ids = ALL
    project_ids = ALL

    def __repr__(self):
        return '<{}>'.format(type(self).__name__)


UnrestrictedTenant = UnrestrictedTenant()


def get_current_user():
    """
    Retrieve the user from the current request

    >>> get_current_user()
    <User id=1>
    """
    if not env.request:
        return None
    return env.request.user


def load_tenant_from_request():
    """
    Load the tenant for the current request.

    >>> load_tenant_from_request()
    <Tenant user_id=1L>
    """
    user = get_current_user()
    return Tenant.from_user(user)


def get_current_tenant():
    """
    Retrieve the current tenant, from the active request
    if available.

    >>> get_current_tenant()
    <UnrestrictedTenant>
    """
    rv = getattr(env, 'tenant', None)
    if rv is None:
        rv = load_tenant_from_request()
        env.tenant = rv
    return rv


def set_current_tenant(tenant):
    """
    Set the current tenant.

    >>> set_current_tenant(UnrestrictedTenant)
    """
    env.tenant = tenant


class TenantContext(object):
    """
    Bind a tenant within a given context.

    >>> with TenantContext(UnrestrictedTenant):
    >>>   # I'm free!!!!!
    """

    def __init__(self, tenant):
        self.tenant = tenant

    def __enter__(self):
        self.current_tenant = get_current_tenant()
        set_current_tenant(self.tenant)

    def __exit__(self, *exc_info):
        set_current_tenant(self.current_tenant)
