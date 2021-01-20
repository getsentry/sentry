from __future__ import absolute_import

import six

from threading import local

from django.core.cache import caches, InvalidCacheBackendError

from sentry.utils.cache import memoize
from sentry.utils import json
from sentry.utils.services import Service


# Cache an instance of the encoder we want to use
json_dumps = json.JSONEncoder(
    separators=(",", ":"),
    sort_keys=True,
    skipkeys=False,
    ensure_ascii=True,
    check_circular=True,
    allow_nan=True,
    indent=None,
    encoding="utf-8",
    default=None,
).encode

json_loads = json._default_decoder.decode


class NodeStorage(local, Service):
    __all__ = (
        "delete",
        "delete_multi",
        "get",
        "get_multi",
        "set",
        "cleanup",
        "validate",
        "bootstrap",
        "_get_cache_item",
        "_get_cache_items",
        "_set_cache_item",
        "_delete_cache_item",
        "_delete_cache_items",
    )

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

    def _decode(self, value):
        if value is not None:
            return json_loads(value)

        return None

    def _get_bytes(self, id):
        """
        >>> nodestore._get_bytes('key1')
        b'{"message": "hello world"}'
        """
        raise NotImplementedError

    def get(self, id):
        """
        >>> nodestore.get('key1')
        {"message": "hello world"}
        """
        item_from_cache = self._get_cache_item(id)
        if item_from_cache:
            return item_from_cache

        data = self._decode(self._get_bytes(id))
        self._set_cache_item(id, data)
        return data

    def _get_bytes_multi(self, id_list):
        """
        >>> nodestore._get_bytes_multi(['key1', 'key2')
        {
            "key1": b'{"message": "hello world"}',
            "key2": b'{"message": "hello world"}'
        }
        """
        return dict((id, self._get_bytes(id)) for id in id_list)

    def get_multi(self, id_list):
        """
        >>> nodestore.get_multi(['key1', 'key2')
        {
            "key1": {"message": "hello world"},
            "key2": {"message": "hello world"}
        }
        """
        cache_items = self._get_cache_items(id_list)
        if len(cache_items) == len(id_list):
            return cache_items

        uncached_ids = [id for id in id_list if id not in cache_items]
        items = dict(
            (id, self._decode(value))
            for id, value in six.iteritems(self._get_bytes_multi(uncached_ids))
        )
        self._set_cache_items(items)
        items.update(cache_items)
        return items

    def _encode(self, value):
        return json_dumps(value).encode("utf8")

    def _set_bytes(self, id, data, ttl=None):
        """
        >>> nodestore.set('key1', b"{'foo': 'bar'}")
        """
        raise NotImplementedError

    def set(self, id, data, ttl=None):
        """
        >>> nodestore.set('key1', {'foo': 'bar'})
        """
        self._set_bytes(id, self._encode(data), ttl=ttl)
        self._set_cache_item(id, data)

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
