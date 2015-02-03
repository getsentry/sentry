"""
sentry.buffer.redis
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from time import time

from django.conf import settings
from django.db import models
from django.utils.encoding import smart_str
from hashlib import md5
from nydus.db import create_cluster
from sentry.buffer import Buffer
from sentry.tasks.process_buffer import process_incr
from sentry.utils.compat import pickle
from sentry.utils.imports import import_string


class RedisBuffer(Buffer):
    key_expire = 60 * 60  # 1 hour
    pending_key = 'b:p'

    def __init__(self, **options):
        if not options:
            # inherit default options from REDIS_OPTIONS
            options = settings.SENTRY_REDIS_OPTIONS

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

    def _make_key(self, model, filters):
        """
        Returns a Redis-compatible key for the model given filters.
        """
        return 'b:k:%s:%s' % (
            model._meta,
            md5(smart_str('&'.join('%s=%s' % (k, self._coerce_val(v))
                for k, v in sorted(filters.iteritems())))).hexdigest(),
        )

    def _make_lock_key(self, key):
        return 'l:%s' % (key,)

    def incr(self, model, columns, filters, extra=None):
        """
        Increment the key by doing the following:

        - Insert/update a hashmap based on (model, columns)
            - Perform an incrby on counters
            - Perform a set (last write wins) on extra
        - Add hashmap key to pending flushes
        """
        # TODO(dcramer): longer term we'd rather not have to serialize values
        # here (unless it's to JSON)
        key = self._make_key(model, filters)
        # We can't use conn.map() due to wanting to support multiple pending
        # keys (one per Redis shard)
        conn = self.conn.get_conn(key)

        pipe = conn.pipeline()
        pipe.hsetnx(key, 'm', '%s.%s' % (model.__module__, model.__name__))
        pipe.hsetnx(key, 'f', pickle.dumps(filters))
        for column, amount in columns.iteritems():
            pipe.hincrby(key, 'i+' + column, amount)

        if extra:
            for column, value in extra.iteritems():
                pipe.hset(key, 'e+' + column, pickle.dumps(value))
        pipe.expire(key, self.key_expire)
        pipe.zadd(self.pending_key, key, time())
        pipe.execute()

    def process_pending(self):
        lock_key = self._make_lock_key(self.pending_key)
        # prevent a stampede due to celerybeat + periodic task
        if not self.conn.setnx(lock_key, '1'):
            return
        self.conn.expire(lock_key, 60)

        try:
            for conn in self.conn.hosts.itervalues():
                keys = conn.zrange(self.pending_key, 0, -1)
                if not keys:
                    continue
                for key in keys:
                    process_incr.apply_async(kwargs={
                        'key': key,
                    })
                pipe = conn.pipeline()
                pipe.zrem(self.pending_key, *keys)
                pipe.execute()
        finally:
            self.conn.delete(lock_key)

    def process(self, key):
        lock_key = self._make_lock_key(key)
        # prevent a stampede due to the way we use celery etas + duplicate
        # tasks
        if not self.conn.setnx(lock_key, '1'):
            return
        self.conn.expire(lock_key, 10)

        with self.conn.map() as conn:
            values = conn.hgetall(key)
            conn.delete(key)

        if not values:
            return

        model = import_string(values['m'])
        filters = pickle.loads(values['f'])
        incr_values = {}
        extra_values = {}
        for k, v in values.iteritems():
            if k.startswith('i+'):
                incr_values[k[2:]] = int(v)
            elif k.startswith('e+'):
                extra_values[k[2:]] = pickle.loads(v)

        super(RedisBuffer, self).process(model, incr_values, filters, extra_values)
