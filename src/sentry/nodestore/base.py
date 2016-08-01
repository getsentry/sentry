"""
sentry.nodestore.base
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six

from base64 import b64encode
from threading import local
from uuid import uuid4


class NodeStorage(local):
    def validate(self):
        """
        Validates the settings for this backend (i.e. such as proper connection
        info).

        Raise ``InvalidConfiguration`` if there is a configuration error.
        """

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

    def delete_multi(self, id_list):
        """
        Delete multiple nodes.

        Note: This is not guaranteed to be atomic and may result in a partial
        delete.

        >>> delete_multi(['key1', 'key2'])
        """
        for id in id_list:
            self.delete(id)

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
        for id, data in six.iteritems(values):
            self.set(id=id, data=data)

    def generate_id(self):
        return b64encode(uuid4().bytes)

    def cleanup(self, cutoff_timestamp):
        raise NotImplementedError
