"""
sentry.quotas.base
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from collections import namedtuple
from functools import partial
from django.conf import settings

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
        if quota.endswith('%'):
            pct = int(quota[:-1])
            quota = int(parent_quota) * pct / 100
        return int(quota or 0)

    def get_project_quota(self, project):
        from sentry.models import ProjectOption, Team

        project_quota = ProjectOption.objects.get_value(project, 'quotas:per_minute', '')
        if project_quota is None:
            project_quota = settings.SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE

        team = getattr(project, '_team_cache', None)
        if not team:
            team = Team.objects.get_from_cache(id=project.team_id)

        return self.translate_quota(
            project_quota,
            self.get_team_quota(team),
        )

    def get_team_quota(self, team):
        from sentry.models import Organization

        org = getattr(team, '_organization_cache', None)
        if not org:
            org = Organization.objects.get_from_cache(id=team.organization_id)

        return self.translate_quota(
            settings.SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE,
            self.get_organization_quota(org)
        )

    def get_organization_quota(self, organization):
        return self.translate_quota(
            settings.SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE,
            self.get_system_quota()
        )

    def get_system_quota(self):
        return settings.SENTRY_SYSTEM_MAX_EVENTS_PER_MINUTE
