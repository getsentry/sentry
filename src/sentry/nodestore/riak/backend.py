"""
sentry.nodestore.riak.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six

from simplejson import JSONEncoder, _default_decoder

from sentry.nodestore.base import NodeStorage
from .client import RiakClient


# Cache an instance of the encoder we want to use
json_dumps = JSONEncoder(
    separators=(',', ':'),
    skipkeys=False,
    ensure_ascii=True,
    check_circular=True,
    allow_nan=True,
    indent=None,
    encoding='utf-8',
    default=None,
).encode

json_loads = _default_decoder.decode


class RiakNodeStorage(NodeStorage):
    """
    A Riak-based backend for storing node data.

    >>> RiakNodeStorage(nodes=[{'host':'127.0.0.1','port':8098}])
    """
    def __init__(self, nodes, bucket='nodes', timeout=1, cooldown=5,
                 max_retries=3, multiget_pool_size=5, tcp_keepalive=True,
                 protocol=None):
        # protocol being defined is useless, but is needed for backwards
        # compatability and leveraged as an opportunity to yell at the user
        if protocol == 'pbc':
            raise ValueError("'pbc' protocol is no longer supported")
        if protocol is not None:
            import warnings
            warnings.warn("'protocol' has been deprecated",
                          DeprecationWarning)
        self.bucket = bucket
        self.conn = RiakClient(
            hosts=nodes,
            max_retries=max_retries,
            multiget_pool_size=multiget_pool_size,
            cooldown=cooldown,
            tcp_keepalive=tcp_keepalive,
        )

    def set(self, id, data):
        self.conn.put(self.bucket, id, json_dumps(data),
                      returnbody='false')

    def delete(self, id):
        self.conn.delete(self.bucket, id)

    def get(self, id):
        rv = self.conn.get(self.bucket, id, r=1)
        if rv.status != 200:
            return None
        return json_loads(rv.data)

    def get_multi(self, id_list):
        # shortcut for just one id since this is a common
        # case for us from EventManager.bind_nodes
        if len(id_list) == 1:
            id = id_list[0]
            return {id: self.get(id)}

        rv = self.conn.multiget(self.bucket, id_list, r=1)
        results = {}
        for key, value in rv.iteritems():
            if isinstance(value, Exception):
                six.reraise(type(value), value)
            if value.status != 200:
                results[key] = None
            else:
                results[key] = json_loads(value.data)
        return results

    def cleanup(self, cutoff_timestamp):
        # TODO(dcramer): we should either index timestamps or have this run
        # a map/reduce (probably the latter)
        raise NotImplementedError
