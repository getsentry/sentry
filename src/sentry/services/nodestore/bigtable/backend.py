from __future__ import annotations

import os
from datetime import timedelta
from typing import int, Any

import sentry_sdk

from sentry.objectstore.metrics import measure_storage_operation
from sentry.services.nodestore.base import NodeStorage
from sentry.utils.kvstore.bigtable import BigtableKVStorage


class BigtableNodeStorage(NodeStorage):
    """
    A Bigtable-based backend for storing node data.

    :param project: Passed to bigtable client
    :param instance: Passed to bigtable client
    :param table: Passed to bigtable client
    :param automatic_expiry: Whether to set bigtable GC rule.
    :param default_ttl: How many days keys should be stored (and considered
        valid for reading + returning)
    :param compression: A boolean whether to enable zlib-compression, or the
        string "zstd" to use zstd.

    >>> from datetime import timedelta
    >>> BigtableNodeStorage(
    ...     project='some-project',
    ...     instance='sentry',
    ...     table='nodestore',
    ...     default_ttl=timedelta(days=30),
    ...     compression=True,
    ... )
    """

    store_class = BigtableKVStorage

    def __init__(
        self,
        project: str | None = None,
        instance: str = "sentry",
        table: str = "nodestore",
        automatic_expiry: bool = False,
        default_ttl: timedelta | None = None,
        compression: bool | str = False,
        **client_options: object,
    ):
        if compression is True:
            _compression = "zlib"
        elif compression is False:
            _compression = None
        else:
            _compression = compression

        self.store = self.store_class(
            project=project,
            instance=instance,
            table_name=table,
            default_ttl=default_ttl,
            compression=_compression,
            client_options=client_options,
        )
        self.automatic_expiry = automatic_expiry
        self.skip_deletes = automatic_expiry and "_SENTRY_CLEANUP" in os.environ

    @sentry_sdk.tracing.trace
    def _get_bytes(self, id: str) -> bytes | None:
        # Note: This metric encapsulates any decompression performed by `self.store.get()`. Other
        # instances of this metric stop measuring before decompression happens.
        with measure_storage_operation("get", "nodestore") as metric_emitter:
            result = self.store.get(id)
            if result:
                metric_emitter.record_uncompressed_size(len(result))
            return result

    @sentry_sdk.tracing.trace
    def _get_bytes_multi(self, id_list: list[str]) -> dict[str, bytes | None]:
        rv: dict[str, bytes | None] = {id: None for id in id_list}
        # Note: This metric encapsulates any decompression performed by `self.store.get_many()`. Other
        # instances of this metric stop measuring before decompression happens.
        with measure_storage_operation("get-multi", "nodestore"):
            rv.update(self.store.get_many(id_list))
        return rv

    def _set_bytes(self, id: str, data: Any, ttl: timedelta | None = None) -> None:
        # Note: This metric encapsulates any compression performed by `self.store.put()`. Other
        # instances of this metric start measuring after compression happens.
        with measure_storage_operation("put", "nodestore", len(data)):
            self.store.set(id, data, ttl)

    def delete(self, id: str) -> None:
        if self.skip_deletes:
            return

        with sentry_sdk.start_span(op="nodestore.bigtable.delete"):
            try:
                with measure_storage_operation("delete", "nodestore"):
                    self.store.delete(id)
            finally:
                self._delete_cache_item(id)

    def delete_multi(self, id_list: list[str]) -> None:
        if self.skip_deletes:
            return

        with sentry_sdk.start_span(op="nodestore.bigtable.delete_multi") as span:
            span.set_tag("num_ids", len(id_list))

            if len(id_list) == 1:
                self.delete(id_list[0])
                return

            try:
                with measure_storage_operation("delete-multi", "nodestore"):
                    self.store.delete_many(id_list)
            finally:
                self._delete_cache_items(id_list)

    def bootstrap(self) -> None:
        self.store.bootstrap(automatic_expiry=self.automatic_expiry)
