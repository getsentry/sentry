"""
sentry.quotas.base
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from collections import namedtuple
from functools import partial
from django.conf import settings

from sentry import options

RateLimit = namedtuple('RateLimit', ('is_limited', 'retry_after'))
NotRateLimited = RateLimit(False, None)
RateLimited = partial(RateLimit, is_limited=True)


class Quota(object):
    """
    Quotas handle tracking a project's event usage (at a per minute tick) and
    respond whether or not a project has been configured to throttle incoming
    events if they go beyond the specified quota.
    """
    def __init__(self, **options):
        pass

    def validate(self):
        """
        Validates the settings for this backend (i.e. such as proper connection
        info).

        Raise ``InvalidConfiguration`` if there is a configuration error.
        """

    def is_rate_limited(self, project):
        return NotRateLimited

    def get_time_remaining(self):
        return 0

    def translate_quota(self, quota, parent_quota):
        if six.text_type(quota).endswith('%'):
            pct = int(quota[:-1])
            quota = int(parent_quota) * pct / 100
        if not quota:
            return int(parent_quota or 0)
        return int(quota or 0)

    def get_project_quota(self, project):
        from sentry.models import (
            ProjectOption, Organization, OrganizationOption
        )

        # DEPRECATED: Will likely be removed in a future version unless Sentry
        # team is convinced otherwise.
        legacy_quota = ProjectOption.objects.get_value(project, 'quotas:per_minute', '')
        if legacy_quota == '':
            legacy_quota = settings.SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE

        org = getattr(project, '_organization_cache', None)
        if not org:
            org = Organization.objects.get_from_cache(id=project.organization_id)
            project._organization_cache = org

        max_quota_share = int(OrganizationOption.objects.get_value(
            org, 'sentry:project-rate-limit', 100))

        if not legacy_quota and max_quota_share == 100:
            return 0

        org_quota = self.get_organization_quota(org)

        quota = self.translate_quota(
            legacy_quota,
            org_quota,
        )

        # if we have set a max project quota percentage and there's actually
        # a quota set for the org, lets calculate the maximum by using the min
        # of the two quotas
        if max_quota_share != 100 and org_quota:
            if quota:
                quota = min(quota, self.translate_quota(
                    '{}%'.format(max_quota_share),
                    org_quota,
                ))
            else:
                quota = self.translate_quota(
                    '{}%'.format(max_quota_share),
                    org_quota,
                )

        return quota

    def get_organization_quota(self, organization):
        system_rate_limit = options.get('system.rate-limit')
        # If there is only a single org, this one org should
        # be allowed to consume the entire quota.
        if settings.SENTRY_SINGLE_ORGANIZATION:
            return system_rate_limit
        return self.translate_quota(
            settings.SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE,
            system_rate_limit,
        )
