"""
sentry.counters.redis
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import with_statement

import time
from nydus.db import create_cluster
from sentry.counters import Counter
from sentry.conf import settings


class RedisCounter(Counter):
    num_minutes = 15
    key_expire = 60 * num_minutes

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

    def _make_key(self, key, value, when=None, unique=False):
        """
        Returns a Redis-compatible key for the given key/value combination.
        """
        if when is None:
            when = time.time()
        when = int(when / 60)  # chop it down to the minute
        return 'sentry.counters:%s:%s:%s=%s' % (when, int(unique), key, value)

    def incr(self, amount, created=False, **kwargs):
        now = time.time()
        with self.conn.map() as conn:
            keys = [self._make_key('global', '1', now)]
            keys.extend(self._make_key(k, v, now) for k, v in kwargs.iteritems())
            if created:
                keys.extend(self._make_key(k, v, now, True) for k, v in kwargs.iteritems())
            for key in keys:
                conn.incr(key, amount)
                conn.expire(key, self.key_expire)

    def _get_count(self, key=None, value=None, minutes=None, unique=False):
        if minutes is None:
            minutes = self.num_minutes

        if key is value is None:
            key = 'global'
            value = '1'

        now = time.time()
        results = []
        with self.conn.map() as conn:
            for minute in xrange(minutes):
                key = self._make_key(key, value, now - (minutes * 60), unique)
                results.append(conn.get(key))

        return sum(int(r or 0) for r in results)

    def total(self, key, value, minutes=None):
        return self._get_count(key, value, minutes=minutes, unique=False)

    def unique(self, key, value, minutes=None):
        return self._get_count(key, value, minutes=minutes, unique=True)
