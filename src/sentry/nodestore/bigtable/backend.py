from __future__ import annotations

import os
from datetime import timedelta
from typing import Any

import sentry_sdk

from sentry.nodestore.base import NodeStorage
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
        compression: bool = False,
        **client_options: object,
    ):
        if compression is True:
            _compression = "zlib"
        else:
            _compression = None

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

    def _get_bytes(self, id: str) -> bytes | None:
        return self.store.get(id)

    def _get_bytes_multi(self, id_list: list[str]) -> dict[str, bytes | None]:
        rv: dict[str, bytes | None] = {id: None for id in id_list}
        rv.update(self.store.get_many(id_list))
        return rv

    def _set_bytes(self, id: str, data: Any, ttl: timedelta | None = None) -> None:
        self.store.set(id, data, ttl)

    def delete(self, id: str) -> None:
        if self.skip_deletes:
            return

        with sentry_sdk.start_span(op="nodestore.bigtable.delete"):
            try:
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
                self.store.delete_many(id_list)
            finally:
                self._delete_cache_items(id_list)

    def bootstrap(self) -> None:
        self.store.bootstrap(automatic_expiry=self.automatic_expiry)
