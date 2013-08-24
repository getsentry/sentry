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

    def get_project_quota(self, project):
        proj_setting = self.get_option('per_minute', project, '')
        if proj_setting is None:
            proj_setting = settings.SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE
        else:
            proj_setting = int(proj_setting)
        if proj_setting.endswith('%'):
            pct = int(proj_setting[:-1])
            proj_setting = self.get_team_quota(project.team) * pct / 100
        return proj_setting

    def get_team_quota(self, team):
        return settings.SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE

    def get_system_quota(self, team):
        return settings.SENTRY_SYSTEM_MAX_EVENTS_PER_MINUTE
