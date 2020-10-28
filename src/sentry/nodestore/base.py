from __future__ import absolute_import

import six

from base64 import b64encode
from threading import local
from uuid import uuid4

from django.core.cache import caches, InvalidCacheBackendError

from sentry.utils.cache import memoize
from sentry.utils.services import Service


class NodeStorage(local, Service):
    __all__ = (
        "create",
        "delete",
        "delete_multi",
        "get",
        "get_multi",
        "set",
        "set_multi",
        "generate_id",
        "cleanup",
        "validate",
        "bootstrap",
        "_get_cache_item",
        "_get_cache_items",
        "_set_cache_item",
        "_delete_cache_item",
        "_delete_cache_items",
    )

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
        return dict((id, self.get(id)) for id in id_list)

    def set(self, id, data, ttl=None):
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

    def bootstrap(self):
        raise NotImplementedError

    def _get_cache_item(self, id):
        if self.cache:
            return self.cache.get(id)

    def _get_cache_items(self, id_list):
        if self.cache:
            return self.cache.get_many(id_list)
        return {}

    def _set_cache_item(self, id, data):
        if self.cache and data:
            self.cache.set(id, data)

    def _set_cache_items(self, items):
        cacheable_items = {k: v for k, v in six.iteritems(items) if v}
        if self.cache:
            self.cache.set_many(cacheable_items)

    def _delete_cache_item(self, id):
        if self.cache:
            self.cache.delete(id)

    def _delete_cache_items(self, id_list):
        if self.cache:
            self.cache.delete_many(id_list)

    @memoize
    def cache(self):
        try:
            return caches["nodedata"]
        except InvalidCacheBackendError:
            return None
