"""
sentry.buffer.redis
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import with_statement

from django.core.exceptions import ImproperlyConfigured

for package in ('nydus', 'redis'):
    try:
        __import__(package, {}, {}, [], -1)
    except ImportError:
        raise ImproperlyConfigured(
            'Missing %r package, which is required for Redis buffers' % (
                package,))

from hashlib import md5
from nydus.db import create_cluster

from django.db.models import F
from django.db.models.expressions import ExpressionNode
from django.utils.encoding import smart_str

from sentry.buffer import Buffer
from sentry.conf import settings
from sentry.utils.db import resolve_simple_expression


def checksum(values):
    result = md5()
    for value in values:
        result.update(smart_str(value))
    return result.hexdigest()


class RedisBuffer(Buffer):
    key_expire = 60 * 60  # 1 hour

    def __init__(self, **options):
        if not options:
            # inherit default options from REDIS_OPTIONS
            options = settings.REDIS_OPTIONS

        super(RedisBuffer, self).__init__(**options)
        options.setdefault('hosts', {
            0: {},
        })
        options.setdefault('router', 'nydus.db.routers.keyvalue.PartitionRouter')
        self.conn = create_cluster({
            'engine': 'nydus.db.backends.redis.Redis',
            'router': options['router'],
            'hosts': options['hosts'],
        })

    def _make_key(self, namespace, callback, args):
        """
        Returns a Redis-compatible key for the model given filters.
        """
        return 'buffer:%s.%s:%s:%s' % (
            callback.__module__, callback.__name__, namespace, checksum(args)
        )

    def _make_task_key(self, callback, args):
        return self._make_key('task', callback, args)

    def _make_lock_key(self, callback, args):
        return self._make_key('lock', callback, args)

    def delay(self, callback, args=None, values=None):
        if values is None:
            return

        with self.conn.map() as conn:
            key = self._make_task_key(callback, args)
            for name, value in values.iteritems():
                # HACK:
                if isinstance(value, ExpressionNode):
                    value = resolve_simple_expression(value)
                    conn.hincrby(key, name, value)
                else:
                    conn.hset(key, name, value)
                conn.expire(key, self.key_expire)
        super(RedisBuffer, self).delay(callback, args, values)

    def process(self, callback, args=None, values=None):
        if values is None:
            return

        lock_key = self._make_lock_key(callback, args)
        # prevent a stampede due to the way we use celery etas + duplicate
        # tasks
        result = self.conn.setnx(lock_key, '1')
        if not result:
            self.logger.debug('Failed to acquired lock: %r', lock_key)
            return
        self.conn.expire(lock_key, self.countdown)

        key = self._make_task_key(callback, args)
        with self.conn.map() as conn:
            stored_values = conn.hgetall(key)
            conn.delete(key)

        if not stored_values:
            self.logger.debug('Job had no stored values: %r', key)
            return

        for key, value in values.iteritems():
            if isinstance(value, ExpressionNode):
                values[key] = resolve_simple_expression(
                    F(key) + int(stored_values.get(key, 0)))

        super(RedisBuffer, self).process(callback, args, values)
