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

    def __init__(self, is_limited, retry_after=None, reason=None, reason_code=None):
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


class Quota(Service):
    """
    Quotas handle tracking a project's event usage (at a per minute tick) and
    respond whether or not a project has been configured to throttle incoming
    events if they go beyond the specified quota.
    """
    __all__ = (
        'get_maximum_quota', 'get_organization_quota', 'get_project_quota', 'is_rate_limited',
        'translate_quota', 'validate', 'refund', 'get_event_retention',
    )

    def __init__(self, **options):
        pass

    def is_rate_limited(self, project, key=None):
        return NotRateLimited()

    def refund(self, project, key=None, timestamp=None):
        raise NotImplementedError

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
            org = Organization.objects.get_from_cache(id=project.organization_id)
            project._organization_cache = org

        max_quota_share = int(
            OrganizationOption.objects.get_value(org, 'sentry:project-rate-limit', 100)
        )

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

        account_limit = int(
            OrganizationOption.objects.get_value(
                organization=organization,
                key='sentry:account-rate-limit',
                default=0,
            )
        )

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

        return (
            self.translate_quota(
                settings.SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE,
                system_limit,
            ), 60
        )

    def get_maximum_quota(self, organization):
        """
        Return the maximum capable rate for an organization.
        """
        return (options.get('system.rate-limit'), 60)

    def get_event_retention(self, organization):
        return options.get('system.event-retention-days') or None
