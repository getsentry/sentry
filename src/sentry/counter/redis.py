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

    def _make_key(self, prefix, when=None):
        """
        Returns a Redis-compatible key for the given key/value combination.
        """
        if when is None:
            when = time.time()
        when = int(when / 60)  # chop it down to the minute
        return 'sentry.counter:%s:%s' % (prefix, when)

    def incr(self, group):
        now = time.time()
        with self.conn.map() as conn:
            keys = [(self._make_key('project', now), group.project_id)]
            keys = [(self._make_key('group', now), group.id)]

            for key, member in keys:
                conn.zincrby(key, member)
                conn.expire(key, 60 * self.MINUTES)

    def extract_counts(self, when=None, prefix='project'):
        # TODO: this could become expensive as it scales linearly with the number of unique
        # items to check
        if not when:
            when = time.time() - 60
        with self.conn.map() as conn:
            key = self._make_key(prefix, when)
            results = conn.zrange(key)
            conn.delete(key)

        return {
            'when': when,
            'results': results,
        }
