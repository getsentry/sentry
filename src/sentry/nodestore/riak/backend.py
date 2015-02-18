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

# XXX(dcramer): I realize this is a private function. We lock in versions, so
# we're going to treat it as a public API as it's better than re-implementing
# the function using the other public APIs.
from riak.client.transport import _is_retryable
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
        except Exception as err:
            if _is_retryable(err):
                sleep(0.01)
            raise
    raise


# TODO(dcramer): ideally we would use Nydus here, but we need to confirm that
# the Riak backend is in good shape. This would resolve some issues we see with
# riak-python, and Nydus is a much more lean codebase that removes a lot of the
# complexities (and thus, things features dont want or plan to use)
class RiakNodeStorage(NodeStorage):
    """
    A Riak-based backend for storing node data.

    >>> RiakNodeStorage(nodes=[{'host':'127.0.0.1','http_port':8098}])

    Due to issues with riak-python, we implement our own retry strategy for the
    get_multi behavior.
    """
    def __init__(self, nodes, bucket='nodes',
                 resolver=riak.resolver.last_written_resolver,
                 protocol='http',
                 max_retries=3):
        self._client_options = {
            'nodes': nodes,
            'resolver': resolver,
            'protocol': protocol,
            'retries': 0,
        }
        self._bucket_name = bucket
        self.max_retries = max_retries

    @memoize
    def conn(self):
        return riak.RiakClient(**self._client_options)

    @memoize
    def bucket(self):
        return self.conn.bucket(self._bucket_name)

    def create(self, data):
        node_id = self.generate_id()
        obj = self.bucket.new(data=data, key=node_id)
        retry(self.max_retries, obj.store)
        return obj.key

    def delete(self, id):
        obj = self.bucket.new(key=id)
        retry(self.max_retries, obj.delete)

    def get(self, id):
        # just fetch it from a random backend, we're not aiming for consistency
        obj = retry(self.max_retries, self.bucket.get, key=id, r=1)
        if not obj:
            return None
        return obj.data

    def get_multi(self, id_list):
        attempt_num = 0
        results = {}
        while id_list and attempt_num < self.max_retries:
            attempt_num += 1
            result = self.bucket.multiget(id_list, r=1)
            id_list = []
            for obj in result:
                # errors return a tuple of (bucket, key, err)
                if isinstance(obj, tuple):
                    err = obj[3]
                    if attempt_num == self.max_retries:
                        six.reraise(type(err), err)
                    elif _is_retryable(err):
                        id_list.append(obj[2])
                    else:
                        six.reraise(type(err), err)
                else:
                    results[obj.key] = obj.data
        return results

    def set(self, id, data):
        obj = self.bucket.new(key=id, data=data)
        retry(self.max_retries, obj.store)

    def cleanup(self, cutoff_timestamp):
        # TODO(dcramer): we should either index timestamps or have this run
        # a map/reduce (probably the latter)
        raise NotImplementedError
