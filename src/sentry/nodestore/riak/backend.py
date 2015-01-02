"""
sentry.nodestore.riak.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import riak
import riak.resolver

import six

from time import sleep

from sentry.nodestore.base import NodeStorage
from sentry.utils.cache import memoize


# Riak commonly has timeouts or non-200 HTTP errors. Being that almost
# always our messages are immutable, it's safe to simply retry in many
# cases
def retry(attempts, func, *args, **kwargs):
    for _ in range(attempts):
        try:
            return func(*args, **kwargs)
        except Exception:
            sleep(0.01)
    raise


class RiakNodeStorage(NodeStorage):
    """
    A Riak-based backend for storing node data.

    >>> RiakNodeStorage(nodes=[{'host':'127.0.0.1','http_port':8098}])
    """
    def __init__(self, nodes, bucket='nodes',
                 resolver=riak.resolver.last_written_resolver,
                 protocol='http'):
        self._client_options = {
            'nodes': nodes,
            'resolver': resolver,
            'protocol': protocol,
        }
        self._bucket_name = bucket

    @memoize
    def conn(self):
        return riak.RiakClient(**self._client_options)

    @memoize
    def bucket(self):
        return self.conn.bucket(self._bucket_name)

    def create(self, data):
        node_id = self.generate_id()
        obj = self.bucket.new(data=data, key=node_id)
        retry(3, obj.store)
        return obj.key

    def delete(self, id):
        obj = self.bucket.new(key=id)
        retry(3, obj.delete)

    def get(self, id):
        # just fetch it from a random backend, we're not aiming for consistency
        obj = self.bucket.get(key=id, r=1)
        if not obj:
            return None
        return obj.data

    def get_multi(self, id_list, r=1):
        result = self.bucket.multiget(id_list)

        results = {}
        for obj in result:
            # errors return a tuple of (bucket, key, err)
            if isinstance(obj, tuple):
                err = obj[2]
                six.reraise(type(err), err)
            results[obj.key] = obj.data
        return results

    def set(self, id, data):
        obj = self.bucket.new(key=id, data=data)
        retry(3, obj.store)

    def cleanup(self, cutoff_timestamp):
        # TODO(dcramer): we should either index timestamps or have this run
        # a map/reduce (probably the latter)
        raise NotImplementedError
