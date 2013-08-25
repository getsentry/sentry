"""
sentry.quotas.base
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings


class Quota(object):
    """
    Quotas handle tracking a project's event usage (at a per minute tick) and
    respond whether or not a project has been configured to throttle incoming
    events if they go beyond the specified quota.
    """
    def __init__(self, **options):
        pass

    def is_rate_limited(self, project):
        return False

    def translate_quota(self, quota, parent_quota):
        if quota.endswith('%'):
            pct = int(quota[:-1])
            quota = parent_quota * pct / 100
        return int(quota or 0)

    def get_project_quota(self, project):
        from sentry.models import ProjectOption

        project_quota = ProjectOption.objects.get_value(project, 'per_minute', '')
        if project_quota is None:
            project_quota = settings.SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE

        return self.translate_quota(
            project_quota,
            self.get_team_quota(project.team),
        )

    def get_team_quota(self, team):
        return self.translate_quota(
            settings.SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE,
            self.get_system_quota()
        )

    def get_system_quota(self):
        return settings.SENTRY_SYSTEM_MAX_EVENTS_PER_MINUTE
