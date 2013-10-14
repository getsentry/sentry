"""
sentry.quotas.redis
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings
from nydus.db import create_cluster
from sentry.quotas.base import Quota


import time


class RedisQuota(Quota):
    ttl = 60

    def __init__(self, **options):
        if not options:
            # inherit default options from REDIS_OPTIONS
            options = settings.SENTRY_REDIS_OPTIONS
        super(RedisQuota, self).__init__(**options)
        options.setdefault('hosts', {0: {}})
        options.setdefault('router', 'nydus.db.routers.keyvalue.PartitionRouter')
        self.conn = create_cluster({
            'engine': 'nydus.db.backends.redis.Redis',
            'router': options['router'],
            'hosts': options['hosts'],
        })

    def is_rate_limited(self, project):
        proj_quota = self.get_project_quota(project)
        if project.team:
            team_quota = self.get_team_quota(project.team)
        else:
            team_quota = 0
        system_quota = self.get_system_quota()

        if not (proj_quota or system_quota or team_quota):
            return False

        sys_result, team_result, proj_result = self._incr_project(project)

        if proj_quota and proj_result > proj_quota:
            return True

        if team_quota and team_result > team_quota:
            return True

        if system_quota and sys_result > system_quota:
            return True

        return False

    def _get_system_key(self):
        return 'quota:s:%s' % (int(time.time() / 60),)

    def _get_team_key(self, team):
        return 'quota:t:%s:%s' % (team.id, int(time.time() / 60))

    def _get_project_key(self, project):
        return 'quota:p:%s:%s' % (project.id, int(time.time() / 60))

    def _incr_project(self, project):
        if project.team:
            team_key = self._get_team_key(project.team)
        else:
            team_key = None
            team_result = 0

        proj_key = self._get_project_key(project)
        sys_key = self._get_system_key()
        with self.conn.map() as conn:
            proj_result = conn.incr(proj_key)
            conn.expire(proj_key, self.ttl)
            sys_result = conn.incr(sys_key)
            conn.expire(sys_key, self.ttl)
            if team_key:
                team_result = conn.incr(team_key)
                conn.expire(team_key, self.ttl)

        return int(sys_result), int(team_result), int(proj_result)
