from threading import local

import sentry_sdk

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
    """
    Nodestore is a key-value store that is used to store event payloads. It comes in two flavors:

    * Django backend, which is just KV-store implemented on top of postgres.
    * Bigtable backend

    Keys (ids) in nodestore are strings, and values (nodes) are
    JSON-serializable objects. Nodestore additionally has the concept of
    subkeys, which are additional JSON payloads that should be stored together
    with the same "main" value. Internally those values are concatenated and
    compressed as one bytestream which makes them compress very well. This:

    >>> nodestore.set("key1", "my key")
    >>> nodestore.set("key1.1", "my key 2")
    >>> nodestore.get("key1")
    "my key"
    >>> nodestore.get("key1.1")
    "my key 2"

    ...very likely takes more space than:

    >>> nodestore.set_subkeys("key1", {None: "my key", "1": "my key 2"})
    >>> nodestore.get("key1")
    "my key"
    >>> nodestore.get("key1", subkey="1")
    "my key 2"

    ...simply because compressing "my key<SEPARATOR>my key 2" yields better
    compression ratio than compressing each key individually.

    This is used in reprocessing to store a snapshot of the event from multiple
    stages of the pipeline.
    """

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
                # Those keys should be statically known identifiers in the app, such as
                # "unprocessed_event". There is really no reason to allow anything but
                # ASCII here.
                subkey = subkey.encode("ascii")

                next(lines_iter)

                for line in lines_iter:
                    if line.strip() == subkey:
                        break

                    next(lines_iter)

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
        with sentry_sdk.start_span(op="nodestore.get") as span:
            if subkey is None:
                item_from_cache = self._get_cache_item(id)
                if item_from_cache:
                    span.set_tag("origin", "from_cache")
                    span.set_tag("found", bool(item_from_cache))
                    return item_from_cache

            span.set_tag("subkey", str(subkey))
            bytes_data = self._get_bytes(id)
            rv = self._decode(bytes_data, subkey=subkey)
            if subkey is None:
                # set cache item only after we know decoding did not fail
                self._set_cache_item(id, rv)

            span.set_tag("result", "from_service")
            if bytes_data:
                span.set_tag("bytes.size", len(bytes_data))
            span.set_tag("found", bool(rv))

            return rv

    def _get_bytes_multi(self, id_list):
        """
        >>> nodestore._get_bytes_multi(['key1', 'key2')
        {
            "key1": b'{"message": "hello world"}',
            "key2": b'{"message": "hello world"}'
        }
        """
        return {id: self._get_bytes(id) for id in id_list}

    def get_multi(self, id_list, subkey=None):
        """
        >>> nodestore.get_multi(['key1', 'key2')
        {
            "key1": {"message": "hello world"},
            "key2": {"message": "hello world"}
        }
        """
        with sentry_sdk.start_span(op="nodestore.get_multi") as span:
            span.set_tag("subkey", str(subkey))
            span.set_tag("num_ids", len(id_list))

            if subkey is None:
                cache_items = self._get_cache_items(id_list)
                if len(cache_items) == len(id_list):
                    span.set_tag("result", "from_cache")
                    return cache_items

                uncached_ids = [id for id in id_list if id not in cache_items]
            else:
                uncached_ids = id_list

            items = {
                id: self._decode(value, subkey=subkey)
                for id, value in self._get_bytes_multi(uncached_ids).items()
            }
            if subkey is None:
                self._set_cache_items(items)
                items.update(cache_items)

            span.set_tag("result", "from_service")
            span.set_tag("found", len(items))

            return items

    def _encode(self, data):
        """
        Encode data dict in a way where its keys can be deserialized
        independently. A `None` key must always be present which is served as
        the "default" subkey (the regular event payload).

        >>> _encode({"unprocessed": {}, None: {"stacktrace": {}}})
        b'{"stacktrace": {}}\nunprocessed\n{}'
        """
        lines = [json_dumps(data.pop(None)).encode("utf8")]
        for key, value in data.items():
            lines.append(key.encode("ascii"))
            lines.append(json_dumps(value).encode("utf8"))

        return b"\n".join(lines)

    def _set_bytes(self, id, data, ttl=None):
        """
        >>> nodestore.set('key1', b"{'foo': 'bar'}")
        """
        raise NotImplementedError

    def set(self, id, data, ttl=None):
        """
        Set value for `id`. Note that this deletes existing subkeys for `id` as
        well, use `set_subkeys` to write a value + subkeys.

        >>> nodestore.set('key1', {'foo': 'bar'})
        """
        return self.set_subkeys(id, {None: data}, ttl=ttl)

    def set_subkeys(self, id, data, ttl=None):
        """
        Set value for `id` and its subkeys.

        >>> nodestore.set_subkeys('key1', {
        ...    None: {'foo': 'bar'},
        ...    "reprocessing": {'foo': 'bam'},
        ... })

        >>> nodestore.get('key1')
        {'foo': 'bar'}
        >>> nodestore.get('key1', subkey='reprocessing')
        {'foo': 'bam'}
        """
        with sentry_sdk.start_span(op="nodestore.set_subkeys"):
            cache_item = data.get(None)
            bytes_data = self._encode(data)
            self._set_bytes(id, bytes_data, ttl=ttl)
            # set cache only after encoding and write to nodestore has succeeded
            self._set_cache_item(id, cache_item)

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
        if self.cache:
            self.cache.set_many(items)

    def _delete_cache_item(self, id):
        if self.cache:
            self.cache.delete(id)

    def _delete_cache_items(self, id_list):
        if self.cache:
            self.cache.delete_many([id for id in id_list])

    @memoize
    def cache(self):
        try:
            return caches["nodedata"]
        except InvalidCacheBackendError:
            return None
