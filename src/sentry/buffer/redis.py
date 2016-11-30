"""
sentry.buffer.redis
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from time import time

from django.db import models
from django.utils.encoding import force_bytes

from sentry.buffer import Buffer
from sentry.exceptions import InvalidConfiguration
from sentry.tasks.process_buffer import process_incr
from sentry.utils import metrics
from sentry.utils.compat import pickle
from sentry.utils.hashlib import md5_text
from sentry.utils.imports import import_string
from sentry.utils.redis import get_cluster_from_options


class RedisBuffer(Buffer):
    key_expire = 60 * 60  # 1 hour
    pending_key = 'b:p'

    def __init__(self, **options):
        self.cluster, options = get_cluster_from_options('SENTRY_BUFFER_OPTIONS', options)

    def validate(self):
        try:
            with self.cluster.all() as client:
                client.ping()
        except Exception as e:
            raise InvalidConfiguration(six.text_type(e))

    def _coerce_val(self, value):
        if isinstance(value, models.Model):
            value = value.pk
        return force_bytes(value, errors='replace')

    def _make_key(self, model, filters):
        """
        Returns a Redis-compatible key for the model given filters.
        """
        return 'b:k:%s:%s' % (
            model._meta,
            md5_text(
                '&'.join('%s=%s' % (k, self._coerce_val(v))
                    for k, v in sorted(six.iteritems(filters)))
            ).hexdigest(),
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
        conn = self.cluster.get_local_client_for_key(key)

        pipe = conn.pipeline()
        pipe.hsetnx(key, 'm', '%s.%s' % (model.__module__, model.__name__))
        pipe.hsetnx(key, 'f', pickle.dumps(filters))
        for column, amount in six.iteritems(columns):
            pipe.hincrby(key, 'i+' + column, amount)

        if extra:
            for column, value in six.iteritems(extra):
                pipe.hset(key, 'e+' + column, pickle.dumps(value))
        pipe.expire(key, self.key_expire)
        pipe.zadd(self.pending_key, time(), key)
        pipe.execute()

    def process_pending(self):
        client = self.cluster.get_routing_client()
        lock_key = self._make_lock_key(self.pending_key)
        # prevent a stampede due to celerybeat + periodic task
        if not client.set(lock_key, '1', nx=True, ex=60):
            return

        try:
            keycount = 0
            with self.cluster.all() as conn:
                results = conn.zrange(self.pending_key, 0, -1)

            with self.cluster.all() as conn:
                for host_id, keys in six.iteritems(results.value):
                    if not keys:
                        continue
                    keycount += len(keys)
                    for key in keys:
                        process_incr.apply_async(kwargs={
                            'key': key,
                        })
                    conn.target([host_id]).zrem(self.pending_key, *keys)
            metrics.timing('buffer.pending-size', keycount)
        finally:
            client.delete(lock_key)

    def process(self, key):
        client = self.cluster.get_routing_client()
        lock_key = self._make_lock_key(key)
        # prevent a stampede due to the way we use celery etas + duplicate
        # tasks
        if not client.set(lock_key, '1', nx=True, ex=10):
            metrics.incr('buffer.revoked', tags={'reason': 'locked'})
            self.logger.debug('buffer.revoked.locked', extra={'redis_key': key})
            return

        try:
            conn = self.cluster.get_local_client_for_key(key)
            pipe = conn.pipeline()
            pipe.hgetall(key)
            pipe.zrem(self.pending_key, key)
            pipe.delete(key)
            values = pipe.execute()[0]

            if not values:
                metrics.incr('buffer.revoked', tags={'reason': 'empty'})
                self.logger.debug('buffer.revoked.empty', extra={'redis_key': key})
                return

            model = import_string(values['m'])
            filters = pickle.loads(values['f'])
            incr_values = {}
            extra_values = {}
            for k, v in six.iteritems(values):
                if k.startswith('i+'):
                    incr_values[k[2:]] = int(v)
                elif k.startswith('e+'):
                    extra_values[k[2:]] = pickle.loads(v)

            super(RedisBuffer, self).process(model, incr_values, filters, extra_values)
        finally:
            client.delete(lock_key)
