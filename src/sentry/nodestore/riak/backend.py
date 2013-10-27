"""
sentry.nodestore.riak.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import riak
import riak.resolver

from sentry.nodestore.base import NodeStorage


class RiakNodeStorage(NodeStorage):
    """
    A Riak-based backend for storing node data.

    >>> RiakNodeStorage(nodes=[{'host':'127.0.0.1','http_port':8098}])
    """
    def __init__(self, nodes, bucket='nodes',
                 resolver=riak.resolver.last_written_resolver, **kwargs):
        self.conn = riak.RiakClient(
            nodes=nodes, resolver=resolver, **kwargs)
        self.bucket = self.conn.bucket(bucket)
        super(RiakNodeStorage, self).__init__(**kwargs)

    def create(self, data):
        obj = self.bucket.new(data=data)
        obj.store()
        return obj.key

    def delete(self, id):
        obj = self.bucket.new(key=id)
        obj.delete()

    def get(self, id):
        # just fetch it from a random backend, we're not aiming for consistency
        obj = self.bucket.get(key=id, r=1)
        if not obj:
            return None
        return obj.data

    def get_multi(self, id_list, r=1):
        result = self.bucket.multiget(id_list)
        return dict(
            (obj.key, obj.data)
            for obj in result
        )

    def set(self, id, data):
        obj = self.bucket.new(key=id, data=data)
        obj.store()

    def cleanup(self, cutoff_timestamp):
        # TODO(dcramer): we should either index timestamps or have this run
        # a map/reduce (probably the latter)
        raise NotImplementedError
