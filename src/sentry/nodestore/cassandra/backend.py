"""
sentry.nodestore.cassandra.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

import casscache

from sentry.nodestore.base import NodeStorage
from sentry.utils.cache import memoize


class CassandraNodeStorage(NodeStorage):
    """
    A Cassandra-based backend for storing node data.

    >>> CassandraNodeStorage(
    ...     servers=['127.0.0.1:9042'],
    ...     keyspace='sentry',
    ...     columnfamily='nodestore',
    ... )
    """
    def __init__(self, servers, keyspace='sentry',
                 columnfamily='nodestore', **kwargs):
        self.servers = servers
        self.keyspace = keyspace
        self.columnfamily = columnfamily
        self.options = kwargs
        super(CassandraNodeStorage, self).__init__()

    @memoize
    def connection(self):
        return casscache.Client(
            servers=self.servers,
            keyspace=self.keyspace,
            columnfamily=self.columnfamily,
            **self.options
        )

    def delete(self, id):
        self.connection.delete(id)

    def get(self, id):
        return self.connection.get(id)

    def get_multi(self, id_list):
        return self.connection.get_multi(id_list)

    def set(self, id, data):
        self.connection.set(id, data)
