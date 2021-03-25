import os
import struct
import zlib
from datetime import timedelta
from threading import Lock
from typing import Iterator, Optional, Sequence, Tuple

import sentry_sdk
import zstandard
from django.utils import timezone
from google.api_core import exceptions, retry
from google.cloud import bigtable
from google.cloud.bigtable.row_set import RowSet
from google.cloud.bigtable.table import Table
from sentry.nodestore.base import NodeStorage


_connection_lock = Lock()
_connection_cache = {}


def _compress_data(data, compression):
    flags = 0

    if compression == "zstd":
        flags |= BigtableKVStorage._FLAG_COMPRESSED_ZSTD
        cctx = zstandard.ZstdCompressor()
        data = cctx.compress(data)
    elif compression is True or compression == "zlib":
        flags |= BigtableKVStorage._FLAG_COMPRESSED_ZLIB
        data = zlib.compress(data)
    elif compression is False:
        pass
    else:
        raise ValueError(f"invalid argument for compression: {compression!r}")

    return data, flags


def _decompress_data(data, flags):
    # Check for a compression flag on, if so
    # decompress the data.
    if flags & BigtableKVStorage._FLAG_COMPRESSED_ZLIB:
        return zlib.decompress(data)
    elif flags & BigtableKVStorage._FLAG_COMPRESSED_ZSTD:
        cctx = zstandard.ZstdDecompressor()
        return cctx.decompress(data)
    else:
        return data


def get_connection(project, instance, table, options):
    # XXX: This function is not guaranteed to return a table that is bound to a
    # client with the provided options on a cache hit.
    key = (project, instance, table)
    try:
        # Fast check for an existing table cached
        return _connection_cache[key]
    except KeyError:
        # if missing, we acquire our lock to initialize a new one
        with _connection_lock:
            try:
                # It's possible that the lock was blocked waiting
                # on someone else who already initialized, so
                # we first check again to make sure this isn't the case.
                return _connection_cache[key]
            except KeyError:
                _connection_cache[key] = (
                    bigtable.Client(project=project, **options).instance(instance).table(table)
                )
    return _connection_cache[key]


class BigtableError(Exception):
    pass


class BigtableKVStorage:
    max_size = 1024 * 1024 * 10
    column_family = "x"

    ttl_column = b"t"
    ttl_struct = struct.Struct("<I")
    flags_column = b"f"
    flags_struct = struct.Struct("B")
    data_column = b"0"

    # XXX: Compression flags are assumed to be mutually exclusive, the behavior
    # is explicitly undefined if both bits are set on a particular row.
    _FLAG_COMPRESSED_ZLIB = 1 << 0
    _FLAG_COMPRESSED_ZSTD = 1 << 1

    def __init__(
        self,
        project=None,
        instance="sentry",
        table_name="nodestore",
        client_options=None,
        default_ttl: Optional[timedelta] = None,
        compression=False,
    ) -> None:
        self.project = project
        self.instance = instance
        self.table_name = table_name
        self.client_options = client_options if client_options is not None else {}
        self.default_ttl = default_ttl
        self.compression = compression

    def _get_table(self, admin: bool = False) -> Table:
        if not admin:
            return get_connection(self.project, self.instance, self.table_name, self.client_options)
        else:
            return (
                bigtable.Client(project=self.project, admin=True, **self.client_options)
                .instance(self.instance)
                .table(self.table_name)
            )

    def get(self, key: str) -> Optional[bytes]:
        return self.__decode_row(self._get_table().read_row(key))

    def get_many(self, keys: Sequence[str]) -> Iterator[Tuple[str, bytes]]:
        rows = RowSet()
        for key in keys:
            rows.add_row_key(key)

        for row in self._get_table().read_rows(row_set=rows):
            yield row.row_key.decode("utf-8"), self.__decode_row(row)

    def __decode_row(self, row) -> Optional[bytes]:
        if row is None:
            return None

        columns = row.cells[self.column_family]

        try:
            cell = columns[self.data_column][0]
        except KeyError:
            return None

        # Check if a TTL column exists
        # for this row. If there is,
        # we can use the `timestamp` property of the
        # cells to see if we should return the
        # row or not.
        if self.ttl_column in columns:
            # If we needed the actual value, we could unpack it.
            # ttl = struct.unpack('<I', columns[self.ttl_column][0].value)[0]
            if cell.timestamp < timezone.now():
                return None

        data = cell.value

        # Read our flags
        flags = 0
        if self.flags_column in columns:
            flags = self.flags_struct.unpack(columns[self.flags_column][0].value)[0]

        return _decompress_data(data, flags)

    def set(self, key: str, value: bytes, ttl: Optional[timedelta] = None) -> None:
        # XXX: There is a type mismatch here -- ``direct_row`` expects
        # ``bytes`` but we are providing it with ``str``.
        row = self._get_table().direct_row(key)
        # Call to delete is just a state mutation,
        # and in this case is just used to clear all columns
        # so the entire row will be replaced. Otherwise,
        # if an existing row were mutated, and it took up more
        # than one column, it'd be possible to overwrite
        # beginning columns and still retain the end ones.
        row.delete()

        # If we are setting a TTL on this row,
        # we want to set the timestamp of the cells
        # into the future. This allows our GC policy
        # to delete them when the time comes. It also
        # allows us to filter the rows on read if
        # we are past the timestamp to not return.
        # We want to set a ttl column to the ttl
        # value in the future if we wanted to bump the timestamp
        # and rewrite a row with a new ttl.
        ttl = ttl or self.default_ttl
        if ttl is None:
            # XXX: If ``automatic_expiry`` is enabled and no TTL (default or
            # row-level TTL) is provided, this will default to the Bigtable
            # server timestamp and this row will be immediately evicted per the
            # garbage collection policy.
            ts = None
        else:
            ts = timezone.now() + ttl
            row.set_cell(
                self.column_family,
                self.ttl_column,
                self.ttl_struct.pack(int(ttl.total_seconds())),
                timestamp=ts,
            )

        # Track flags for metadata about this row.
        # This only flag we're tracking now is whether compression
        # is on or not for the data column.
        flags = 0

        data, compression_flag = _compress_data(value, self.compression)
        flags |= compression_flag

        # Only need to write the column at all if any flags
        # are enabled. And if so, pack it into a single byte.
        if flags:
            row.set_cell(
                self.column_family, self.flags_column, self.flags_struct.pack(flags), timestamp=ts
            )

        assert len(data) <= self.max_size

        row.set_cell(self.column_family, self.data_column, data, timestamp=ts)

        status = row.commit()
        if status.code != 0:
            raise BigtableError(status.code, status.message)

    def delete(self, key: str) -> None:
        # XXX: There is a type mismatch here -- ``direct_row`` expects
        # ``bytes`` but we are providing it with ``str``.
        row = self._get_table().direct_row(key)
        row.delete()

        status = row.commit()
        if status.code != 0:
            raise BigtableError(status.code, status.message)

    def delete_many(self, keys: Sequence[str]) -> None:
        table = self._get_table()

        rows = []
        for key in keys:
            # XXX: There is a type mismatch here -- ``direct_row`` expects
            # ``bytes`` but we are providing it with ``str``.
            row = table.direct_row(key)
            row.delete()
            rows.append(row)

        errors = []
        for status in table.mutate_rows(rows):
            if status.code != 0:
                errors.append(BigtableError(status.code, status.message))

        if errors:
            raise BigtableError(errors)

    def bootstrap(self, automatic_expiry: bool = True) -> None:
        table = self._get_table(admin=True)
        if table.exists():
            return

        # With automatic expiry, we set a GC rule to automatically
        # delete rows with an age of 0. This sounds odd, but when
        # we write rows, we write them with a future timestamp as long
        # as a TTL is set during write. By doing this, we are effectively
        # writing rows into the future, and they will be deleted due to TTL
        # when their timestamp is passed.
        if automatic_expiry:
            # NOTE: Bigtable can't actually use 0 TTL, and
            # requires a minimum value of 1ms.
            # > InvalidArgument desc = Error in field 'Modifications list' : Error in element #0 : max_age must be at least one millisecond
            delta = timedelta(milliseconds=1)
            gc_rule = bigtable.column_family.MaxAgeGCRule(delta)
        else:
            gc_rule = None

        retry_504 = retry.Retry(retry.if_exception_type(exceptions.DeadlineExceeded))
        retry_504(table.create)(column_families={self.column_family: gc_rule})


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
        project=None,
        instance="sentry",
        table="nodestore",
        automatic_expiry=False,
        default_ttl=None,
        compression=False,
        **client_options,
    ):
        self.store = self.store_class(
            project=project,
            instance=instance,
            table_name=table,
            default_ttl=default_ttl,
            compression=compression,
            client_options=client_options,
        )
        self.automatic_expiry = automatic_expiry
        self.skip_deletes = automatic_expiry and "_SENTRY_CLEANUP" in os.environ

    def _get_bytes(self, id):
        return self.store.get(id)

    def _get_bytes_multi(self, id_list):
        rv = {id: None for id in id_list}
        rv.update(self.store.get_many(id_list))
        return rv

    def _set_bytes(self, id, data, ttl=None):
        self.store.set(id, data, ttl)

    def delete(self, id):
        if self.skip_deletes:
            return

        with sentry_sdk.start_span(op="nodestore.bigtable.delete"):
            try:
                self.store.delete(id)
            finally:
                self._delete_cache_item(id)

    def delete_multi(self, id_list):
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

    def bootstrap(self):
        self.store.bootstrap(automatic_expiry=self.automatic_expiry)
