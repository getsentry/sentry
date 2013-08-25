"""
sentry.buffer.redis
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.conf import settings
from django.db import models
from django.utils.encoding import smart_str
from hashlib import md5
from nydus.db import create_cluster
from sentry.buffer import Buffer
from sentry.utils.compat import pickle


class RedisBuffer(Buffer):
    key_expire = 60 * 60  # 1 hour

    def __init__(self, **options):
        if not options:
            # inherit default options from REDIS_OPTIONS
            options = settings.SENTRY_REDIS_OPTIONS

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

    def _coerce_val(self, value):
        if isinstance(value, models.Model):
            value = value.pk
        return smart_str(value)

    def _make_key(self, model, filters, column):
        """
        Returns a Redis-compatible key for the model given filters.
        """
        return '%s:%s:%s' % (
            model._meta,
            md5(smart_str('&'.join('%s=%s' % (k, self._coerce_val(v))
                for k, v in sorted(filters.iteritems())))).hexdigest(),
            column,
        )

    def _make_extra_key(self, model, filters):
        return '%s:extra:%s' % (
            model._meta,
            md5(smart_str('&'.join('%s=%s' % (k, self._coerce_val(v))
                for k, v in sorted(filters.iteritems())))).hexdigest(),
        )

    def _make_lock_key(self, model, filters):
        return '%s:lock:%s' % (
            model._meta,
            md5(smart_str('&'.join('%s=%s' % (k, self._coerce_val(v))
                for k, v in sorted(filters.iteritems())))).hexdigest(),
        )

    def incr(self, model, columns, filters, extra=None):
        with self.conn.map() as conn:
            for column, amount in columns.iteritems():
                key = self._make_key(model, filters, column)
                conn.incr(key, amount)
                conn.expire(key, self.key_expire)

            # Store extra in a hashmap so it can easily be removed
            if extra:
                key = self._make_extra_key(model, filters)
                for column, value in extra.iteritems():
                    conn.hset(key, column, pickle.dumps(value))
                    conn.expire(key, self.key_expire)
        super(RedisBuffer, self).incr(model, columns, filters, extra)

    def process(self, model, columns, filters, extra=None):
        lock_key = self._make_lock_key(model, filters)
        # prevent a stampede due to the way we use celery etas + duplicate
        # tasks
        if not self.conn.setnx(lock_key, '1'):
            return
        self.conn.expire(lock_key, self.delay)

        results = {}
        with self.conn.map() as conn:
            for column, amount in columns.iteritems():
                key = self._make_key(model, filters, column)
                results[column] = conn.getset(key, 0)
                conn.expire(key, 60)  # drop expiration as it was just emptied

            hash_key = self._make_extra_key(model, filters)
            extra_results = conn.hgetall(hash_key)
            conn.delete(hash_key)

        # We combine the stored extra values with whatever was passed.
        # This ensures that static values get updated to their latest value,
        # and dynamic values (usually query expressions) are still dynamic.
        if extra_results:
            if not extra:
                extra = {}
            for key, value in extra_results.iteritems():
                if not value:
                    continue
                extra[key] = pickle.loads(str(value))

        # Filter out empty or zero'd results to avoid a potentially unnecessary update
        results = dict((k, int(v)) for k, v in results.iteritems() if int(v or 0) > 0)
        if not results:
            return
        super(RedisBuffer, self).process(model, results, filters, extra)
