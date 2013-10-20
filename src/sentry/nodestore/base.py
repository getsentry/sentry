"""
sentry.nodestore.base
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import uuid


class NodeStorage(object):
    def create(self, data):
        """
        >>> key = nodestore.create({'foo': 'bar'})
        """
        node_id = self.generate_id()
        self.set(node_id, data)
        return node_id

    def delete(self, id):
        """
        >>> nodestore.delete('key1')
        """
        raise NotImplementedError

    def get(self, id):
        """
        >>> data = nodestore.get('key1')
        >>> print data
        """
        raise NotImplementedError

    def get_multi(self, id_list):
        """
        >>> data_map = nodestore.get_multi(['key1', 'key2')
        >>> print 'key1', data_map['key1']
        >>> print 'key2', data_map['key2']
        """
        return dict(
            (id, self.get(id))
            for id in id_list
        )

    def set(self, id, data):
        """
        >>> nodestore.set('key1', {'foo': 'bar'})
        """
        raise NotImplementedError

    def set_multi(self, values):
        """
        >>> nodestore.set_multi({
        >>>     'key1': {'foo': 'bar'},
        >>>     'key2': {'foo': 'baz'},
        >>> })
        """
        for id, data in values.iteritems():
            self.set(id=id, data=data)

    def generate_id(self):
        return uuid.uuid4().hex

    def cleanup(self, cutoff_timestamp):
        raise NotImplementedError
