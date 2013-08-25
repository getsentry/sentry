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
        quota = self.get_active_quota(project)
        system_quota = self.get_system_quota()

        if not (quota or system_quota):
            return False

        sys_result, proj_result = self._incr_project(project)

        if quota and proj_result > quota:
            return True

        if system_quota and sys_result > system_quota:
            return True

        return False

    def _get_system_key(self, project):
        return 'sentry_quotas:system:%s' % (int(time.time() / 60),)

    def _get_project_key(self, project):
        return 'sentry_quotas:%s:%s' % (project.id, int(time.time() / 60))

    def _incr_project(self, project):
        proj_key = self._get_project_key(project)
        sys_key = self._get_system_key()
        with self.conn.map() as conn:
            proj_result = conn.incr(proj_key)
            conn.expire(proj_key, 60)
            sys_result = conn.incr(sys_key)
            conn.expire(sys_key, 60)

        return int(sys_result), int(proj_result)
