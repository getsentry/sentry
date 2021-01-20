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

_NODESTORE_CACHE_VERSION = 2


class NodeStorage(local, Service):
    __all__ = (
        "delete",
        "delete_multi",
        "get",
        "get_multi",
        "set",
        "set_subkeys",
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

    def _decode(self, value, subkey):
        if value is None:
            return None

        lines_iter = iter(value.splitlines())
        try:
            if subkey is not None:
                next(lines_iter)

                for line in lines_iter:
                    if line.strip() == subkey:
                        break

            return json_loads(next(lines_iter))
        except StopIteration:
            return None

    def _get_bytes(self, id):
        """
        >>> nodestore._get_bytes('key1')
        b'{"message": "hello world"}'
        """
        raise NotImplementedError

    def get(self, id, subkey=None):
        """
        >>> nodestore.get('key1')
        {"message": "hello world"}
        """
        if subkey is None:
            item_from_cache = self._get_cache_item(id)
            if item_from_cache:
                return self._decode(item_from_cache, subkey=subkey)

        bytes_data = self._get_bytes(id)
        rv = self._decode(bytes_data, subkey=subkey)
        self._set_cache_item(id, bytes_data)
        return rv

    def _get_bytes_multi(self, id_list):
        """
        >>> nodestore._get_bytes_multi(['key1', 'key2')
        {
            "key1": b'{"message": "hello world"}',
            "key2": b'{"message": "hello world"}'
        }
        """
        return dict((id, self._get_bytes(id)) for id in id_list)

    def get_multi(self, id_list, subkey=None):
        """
        >>> nodestore.get_multi(['key1', 'key2')
        {
            "key1": {"message": "hello world"},
            "key2": {"message": "hello world"}
        }
        """
        cache_items = {
            id: self._decode(value, subkey=subkey)
            for id, value in six.iteritems(self._get_cache_items(id_list))
        }
        if len(cache_items) == len(id_list):
            return cache_items

        uncached_ids = [id for id in id_list if id not in cache_items]

        bytes_items = self._get_bytes_multi(uncached_ids)

        items = {id: self._decode(value, subkey=subkey) for id, value in six.iteritems(bytes_items)}
        self._set_cache_items(bytes_items)
        items.update(cache_items)
        return items

    def _encode(self, data):
        lines = [json_dumps(data.pop(None)).encode("utf8")]
        for key, value in six.iteritems(data):
            lines.append(key.encode("utf8"))
            lines.append(json_dumps(value).encode("utf8"))

        return b"\n".join(lines)

    def _set_bytes(self, id, data, ttl=None):
        """
        >>> nodestore.set('key1', b"{'foo': 'bar'}")
        """
        raise NotImplementedError

    def set(self, id, data, ttl=None):
        """
        >>> nodestore.set('key1', {'foo': 'bar'})
        """
        return self.set_subkeys(id, {None: data}, ttl=ttl)

    def set_subkeys(self, id, data, ttl=None):
        """
        >>> nodestore.set_subkeys('key1', {
        ...    None: {'foo': 'bar'},
        ...    "reprocessing": {'foo': 'bam'},
        ... })

        >>> nodestore.get('key1', subkey='reprocessing')
        {'foo': 'bam'}
        """
        bytes_data = self._encode(data)
        self._set_bytes(id, bytes_data, ttl=ttl)
        self._set_cache_item(id, bytes_data)

    def cleanup(self, cutoff_timestamp):
        raise NotImplementedError

    def bootstrap(self):
        raise NotImplementedError

    def _get_cache_item(self, id):
        if self.cache:
            return self.cache.get(id, version=_NODESTORE_CACHE_VERSION)

    def _get_cache_items(self, id_list):
        if self.cache:
            return self.cache.get_many(id_list, version=_NODESTORE_CACHE_VERSION)
        return {}

    def _set_cache_item(self, id, data):
        if self.cache and data:
            self.cache.set(id, data, version=_NODESTORE_CACHE_VERSION)

    def _set_cache_items(self, items):
        if self.cache:
            self.cache.set_many(items, version=_NODESTORE_CACHE_VERSION)

    def _delete_cache_item(self, id):
        if self.cache:
            self.cache.delete(id, version=_NODESTORE_CACHE_VERSION)

    def _delete_cache_items(self, id_list):
        if self.cache:
            self.cache.delete_many([id for id in id_list], version=_NODESTORE_CACHE_VERSION)

    @memoize
    def cache(self):
        try:
            return caches["nodedata"]
        except InvalidCacheBackendError:
            return None
