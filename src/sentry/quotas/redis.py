"""
sentry.quotas.redis
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from time import time

from sentry.plugins import RateLimitingMixin
from sentry.quotas.base import Quota


class RedisQuota(RateLimitingMixin, Quota):
    ttl = 60

    def get_system_key(self):
        return 'quota:s:%s' % (int(time() / 60),)

    def get_team_key(self, team):
        return 'quota:t:%s:%s' % (team.id, int(time() / 60))

    def get_project_key(self, project):
        return 'quota:p:%s:%s' % (project.id, int(time() / 60))
