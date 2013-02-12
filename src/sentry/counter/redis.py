"""
sentry.counter.redis
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import with_statement

import time
from nydus.db import create_cluster
from sentry.counter import Counter
from sentry.conf import settings


class RedisCounter(Counter):
    def __init__(self, **options):
        if not options:
            # inherit default options from REDIS_OPTIONS
            options = settings.REDIS_OPTIONS

        super(RedisCounter, self).__init__(**options)
        options.setdefault('hosts', {
            0: {},
        })
        options.setdefault('router', 'nydus.db.routers.keyvalue.PartitionRouter')
        self.conn = create_cluster({
            'engine': 'nydus.db.backends.redis.Redis',
            'router': options['router'],
            'hosts': options['hosts'],
        })

    def _make_key(self, prefix, when=None, is_new=False):
        """
        Returns a Redis-compatible key for the given key/value combination.
        """
        if when is None:
            when = time.time()
        when = int(when / 60)  # chop it down to the minute
        return 'sentry.counter:%s:%s:%s' % (prefix, when, int(is_new))

    def incr(self, group, is_new=False):
        now = time.time()
        with self.conn.map() as conn:
            keys = [self._make_key('project', now)]
            if is_new:
                keys.append(self._make_key('project', now, True))

            for key in keys:
                conn.zincrby(key, group.project_id)
                conn.expire(key, 60 * self.MINUTES)

    def _get_count(self, project, minutes=None, is_new=False):
        if minutes is None:
            minutes = self.MINUTES

        now = time.time()
        results = []
        with self.conn.map() as conn:
            for minute in xrange(minutes):
                redis_key = self._make_key('project', now - (minute * 60), is_new)
                results.append(conn.zscore(redis_key, project.id))

        return sum(int(r or 0) for r in results)

    def total(self, project, minutes=None):
        return self._get_count(project, minutes=minutes, is_new=False)

    def new(self, project, minutes=None):
        return self._get_count(project, minutes=minutes, is_new=True)
