"""
sentry.quotas.base
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from django.conf import settings

from sentry import options
from sentry.utils.services import Service


class RateLimit(object):
    __slots__ = ['is_limited', 'retry_after', 'reason', 'reason_code']

    def __init__(self, is_limited, retry_after=None, reason=None,
                 reason_code=None):
        self.is_limited = is_limited
        # delta of seconds in the future to retry
        self.retry_after = retry_after
        # human readable description
        self.reason = reason
        # machine readable description
        self.reason_code = reason_code


class NotRateLimited(RateLimit):
    def __init__(self, **kwargs):
        super(NotRateLimited, self).__init__(False, **kwargs)


class RateLimited(RateLimit):
    def __init__(self, **kwargs):
        super(RateLimited, self).__init__(True, **kwargs)


class BasicQuota(object):
    __slots__ = ['key', 'limit', 'window', 'reason_code', 'enforce']

    def __init__(self, key, limit=0, window=60, reason_code=None,
                 enforce=True):
        # the key is effectively the unique identifier for enforcing this quota
        self.key = key
        # maximum number of events in the given window, 0 indicates "no limit"
        self.limit = limit
        # time in seconds that this quota reflects
        self.window = window
        # a machine readable string
        self.reason_code = reason_code
        # should this quota be hard-enforced (or just tracked)
        self.enforce = enforce

    def __eq__(self, other):
        return isinstance(other, BasicQuota) and hash(self) == hash(other)

    def __hash__(self):
        return hash((self.key, self.limit, self.window, self.reason_code, self.enforce))

    def __repr__(self):
        return u'<{} key={} limit={} window={}>'.format(
            type(self).__name__, self.key, self.limit, self.window)


class Quota(Service):
    """
    Quotas handle tracking a project's event usage (at a per minute tick) and
    respond whether or not a project has been configured to throttle incoming
    events if they go beyond the specified quota.
    """
    __all__ = (
        'get_maximum_quota', 'get_organization_quota', 'get_project_quota',
        'get_quotas', 'is_rate_limited', 'translate_quota', 'validate',
    )

    def __init__(self, **options):
        pass

    def get_actionable_quotas(self, project, key=None):
        """
        Return all implemented quotas which are enabled and actionable.

        This simply suppresses any configured quotas which aren't enabled.
        """
        return [
            quota
            for quota in self.get_quotas(project, key=key)
            # a zero limit means "no limit", not "reject all"
            if quota.limit > 0
            and quota.window > 0
        ]

    def get_quotas(self, project, key=None):
        """
        Return a list of all configured quotas, even ones which aren't
        enabled.
        """
        if key:
            key.project = project
        pquota = self.get_project_quota(project)
        oquota = self.get_organization_quota(project.organization)
        results = [
            BasicQuota(
                key='p:{}'.format(project.id),
                limit=pquota[0],
                window=pquota[1],
                reason_code='project_quota',
            ),
            BasicQuota(
                key='o:{}'.format(project.organization.id),
                limit=oquota[0],
                window=oquota[1],
                reason_code='org_quota',
            ),
        ]
        if key:
            kquota = self.get_key_quota(key)
            results.append(BasicQuota(
                key='k:{}'.format(key.id),
                limit=kquota[0],
                window=kquota[1],
                reason_code='key_quota',
            ))
        return results

    def is_rate_limited(self, project, key=None):
        return NotRateLimited()

    def get_time_remaining(self):
        return 0

    def translate_quota(self, quota, parent_quota):
        if six.text_type(quota).endswith('%'):
            pct = int(quota[:-1])
            quota = int(parent_quota) * pct / 100
        if not quota:
            return int(parent_quota or 0)
        return int(quota or 0)

    def get_key_quota(self, key):
        from sentry import features

        if features.has('projects:rate-limits', key.project):
            return key.rate_limit
        return (0, 0)

    def get_project_quota(self, project):
        from sentry.models import Organization, OrganizationOption

        org = getattr(project, '_organization_cache', None)
        if not org:
            org = Organization.objects.get_from_cache(
                id=project.organization_id)
            project._organization_cache = org

        max_quota_share = int(OrganizationOption.objects.get_value(
            org, 'sentry:project-rate-limit', 100))

        org_quota, window = self.get_organization_quota(org)

        if max_quota_share != 100 and org_quota:
            quota = self.translate_quota(
                '{}%'.format(max_quota_share),
                org_quota,
            )
        else:
            quota = 0

        return (quota, window)

    def get_organization_quota(self, organization):
        from sentry.models import OrganizationOption

        account_limit = int(OrganizationOption.objects.get_value(
            organization=organization,
            key='sentry:account-rate-limit',
            default=0,
        ))

        system_limit = options.get('system.rate-limit')

        # If there is only a single org, this one org should
        # be allowed to consume the entire quota.
        if settings.SENTRY_SINGLE_ORGANIZATION:
            if system_limit < account_limit:
                return (system_limit, 60)
            return (account_limit, 3600)

        # an account limit is enforced, which is set as a fixed value and cannot
        # utilize percentage based limits
        elif account_limit:
            return (account_limit, 3600)

        return (self.translate_quota(
            settings.SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE,
            system_limit,
        ), 60)

    def get_maximum_quota(self, organization):
        """
        Return the maximum capable rate for an organization.
        """
        return (options.get('system.rate-limit'), 60)
