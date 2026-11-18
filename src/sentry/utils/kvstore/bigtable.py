import calendar
import enum
import logging
import struct
import threading
import time
from collections.abc import Iterator, Mapping, Sequence
from datetime import datetime, timedelta
from typing import Any

from django.utils import timezone
from google.api_core import exceptions, retry
from google.cloud import bigtable
from google.cloud.bigtable.data import (
    BigtableDataClient,
    DeleteAllFromRow,
    Mutation,
    MutationsExceptionGroup,
    ReadRowsQuery,
    Row,
    RowMutationEntry,
    SetCell,
    Table,
)
from google.cloud.bigtable.table import Table as AdminTable
from sentry_sdk import traces

from sentry.utils import metrics
from sentry.utils.codecs import Codec, ZlibCodec, ZstdCodec
from sentry.utils.kvstore.abstract import KVStorage

logger = logging.getLogger(__name__)

# The client default is 600 seconds, much too long for our ingestion pipeline
GET_OPERATION_TIMEOUT = 5.0


class BigtableError(Exception):
    pass


def _to_timestamp_micros(dt: datetime) -> int:
    # Bigtable only stores millisecond precision.
    micros = calendar.timegm(dt.utctimetuple()) * 1_000_000 + dt.microsecond
    return micros - micros % 1000


class BigtableKVStorage(KVStorage[str, bytes]):
    column_family = "x"

    # The data column contains a bytearray up that may be up to ``max_size``
    # bytes. The value may be compressed or otherwise encoded based on the
    # value of the ``flags`` column.
    data_column = b"0"
    max_size = 1024 * 1024 * 10

    # The TTL column contains an integer that represents the original TTL
    # (default or row-level) a row was written with in seconds. (The original
    # write timestamp can be calculated by taking the cell timestamp and
    # subtracting this value.) If this column is not present, the row was
    # written without a TTL, and all other columns (data, and optionally flags)
    # will have a cell timestamp that corresponds to when the write occurred.
    ttl_column = b"t"
    ttl_struct = struct.Struct("<I")

    # The flags column contains a single byte that represents a bit set. The
    # structure of the bit set is defined in ``Flags``. If this column is not
    # present in the row returned by Bigtable, its value is assumed to be 0.
    flags_column = b"f"
    flags_struct = struct.Struct("B")

    class Flags(enum.IntFlag):
        # XXX: Compression flags are assumed to be mutually exclusive, the
        # behavior is explicitly undefined if both bits are set on a record.
        COMPRESSED_ZLIB = 1 << 0
        COMPRESSED_ZSTD = 1 << 1

    compression_strategies: Mapping[str, tuple[Flags, Codec[bytes, bytes]]] = {
        "zlib": (Flags.COMPRESSED_ZLIB, ZlibCodec()),
        "zstd": (Flags.COMPRESSED_ZSTD, ZstdCodec()),
    }

    def __init__(
        self,
        instance: str,
        table_name: str,
        project: str | None = None,
        client_options: Mapping[Any, Any] | None = None,
        default_ttl: timedelta | None = None,
        compression: str | None = None,
        app_profile: str | None = None,
    ) -> None:
        client_options = client_options if client_options is not None else {}
        if "admin" in client_options:
            raise ValueError('"admin" cannot be provided as a client option')

        if compression is not None and compression not in self.compression_strategies:
            raise ValueError(f'"compression" must be one of {self.compression_strategies.keys()!r}')

        self.project = project
        self.instance = instance
        self.table_name = table_name
        self.client_options = client_options
        self.default_ttl = default_ttl
        self.compression = compression
        self.app_profile = app_profile

        self.__client: BigtableDataClient | None = None
        self.__table: Table | None = None
        self.__table_lock = threading.Lock()
        self.__close_registered = False

    def _get_admin_table(self) -> AdminTable:
        return (
            bigtable.Client(project=self.project, admin=True, **self.client_options)
            .instance(self.instance)
            .table(self.table_name, app_profile_id=self.app_profile)
        )

    def _get_table(self) -> Table:
        # Fast check for an existing table
        table = self.__table
        if table is not None:
            return table

        # If missing, we acquire our lock to initialize a new one
        with self.__table_lock:
            # It's possible that the lock was blocked waiting on someone else
            # who already initialized, so we first check again to make sure
            # this isn't the case.
            if self.__table is None:
                if not self.__close_registered:
                    # The client refreshes its gRPC channel on an executor
                    # thread, which blocks interpreter shutdown until the
                    # client is closed. ``atexit`` handlers run only after
                    # executor threads are joined, so use the same hook the
                    # executor uses.
                    threading._register_atexit(self._close_client)  # type: ignore[attr-defined]
                    self.__close_registered = True
                self.__client = BigtableDataClient(project=self.project, **self.client_options)
                self.__table = self.__client.get_table(
                    self.instance,
                    self.table_name,
                    app_profile_id=self.app_profile,
                    # Match the retry budgets of the legacy client; the
                    # defaults (600s) are much too long for ingestion.
                    default_read_rows_operation_timeout=60,
                    default_mutate_rows_operation_timeout=120,
                )
            return self.__table

    def _close_client(self) -> None:
        with self.__table_lock:
            client = self.__client
            self.__client = None
            self.__table = None
        if client is not None:
            client.close()

    def get(self, key: str) -> bytes | None:
        with traces.start_span(name="bigtable.get", attributes={"sentry.op": "bigtable.get"}):
            row = self._get_table().read_row(key, operation_timeout=GET_OPERATION_TIMEOUT)
        if row is None:
            return None

        return self.__decode_row(row)

    def get_many(self, keys: Sequence[str]) -> Iterator[tuple[str, bytes]]:
        if not keys:
            # This is probably unintentional, and the behavior isn't specified.
            logging.warning("get_many called with empty keys sequence")
            return

        query = ReadRowsQuery(row_keys=list(keys))
        for row in self._get_table().read_rows(query):
            value = self.__decode_row(row)

            # Even though Bigtable in't going to return empty rows, an empty
            # value may be returned by ``__decode_row`` if the row has
            # outlived its TTL, so we need to check its value here.
            if value is not None:
                yield row.row_key.decode("utf-8"), value

    def __decode_row(self, row: Row) -> bytes | None:
        if (self.column_family, self.data_column) not in row:
            logger.warning("Retrieved row (%r) which does not contain a data column!", row.row_key)
            return None

        # Cells are ordered newest first.
        cell = row.get_cells(self.column_family, self.data_column)[0]

        # Check if a TTL column exists for this row. If there is, we can use
        # the timestamp of the cells to see if we should return the row or
        # not.
        if (self.column_family, self.ttl_column) in row:
            # NOTE: If you need the value, it can be unpacked with the struct.
            if cell.timestamp_micros < time.time_ns() // 1000:
                return None

        value = cell.value

        if (self.column_family, self.flags_column) in row:
            [flags_cell, *_] = row.get_cells(self.column_family, self.flags_column)
            flags = self.Flags(self.flags_struct.unpack(flags_cell.value)[0])

            # Check if there is a compression flag set, if so decompress the value.
            # XXX: If no compression flags are matched, we unfortunately can't
            # tell the difference between data written with a compression
            # strategy that we're not aware of and data that was not compressed
            # at all, so we just return the data and hope for the best. It is
            # also possible that multiple compression flags match. We just stop
            # after the first one matches. Good luck!
            for compression_flag, strategy in self.compression_strategies.values():
                if compression_flag in flags:
                    value = strategy.decode(value)
                    break

        return value

    def set(self, key: str, value: bytes, ttl: timedelta | None = None) -> None:
        try:
            return self._set(key, value, ttl)
        except (exceptions.InternalServerError, exceptions.ServiceUnavailable):
            # Retry once on InternalServerError or ServiceUnavailable
            # 500 Received RST_STREAM with error code 2
            # SENTRY-S6D
            # Unlike the legacy client, the data client refreshes its own
            # channels, so the client isn't recreated (closing it would also
            # break requests in flight on other threads).
            return self._set(key, value, ttl)

    def _set(self, key: str, value: bytes, ttl: timedelta | None = None) -> None:
        # Deleting the row first clears all columns so the entire row will be
        # replaced.
        # Otherwise, if an existing row were mutated, and it took up more than
        # one column, it'd be possible to overwrite beginning columns and still
        # retain the end ones. This also ensures old data is collected during
        # garbage collection, as well ensuring that TTL mutation is respected,
        # particularly if the TTL is reduced (if the prior state was retained,
        # cell values would persist using the longest TTL, not the most
        # recently set TTL.)
        mutations: list[Mutation] = [DeleteAllFromRow()]

        # If we are setting a TTL on this row, we want to set the timestamp of
        # the cells into the future. This allows our GC policy to delete them
        # when the time comes. It also allows us to filter the rows on read if
        # we are past the timestamp to not return. We want to set a ttl column
        # to the ttl value in the future if we wanted to bump the timestamp and
        # rewrite a row with a new ttl.
        ttl = ttl or self.default_ttl
        if ttl is None:
            # XXX: If ``automatic_expiry`` is enabled and no TTL (default or
            # row-level TTL) is provided, this will default to the current
            # time and this row will be immediately evicted per the garbage
            # collection policy. (An explicit client timestamp, rather than a
            # server-assigned one, keeps the mutation idempotent so the client
            # can retry it.)
            ts_micros = _to_timestamp_micros(timezone.now())
        else:
            ts_micros = _to_timestamp_micros(timezone.now() + ttl)
            mutations.append(
                SetCell(
                    self.column_family,
                    self.ttl_column,
                    self.ttl_struct.pack(int(ttl.total_seconds())),
                    timestamp_micros=ts_micros,
                )
            )

        # Track flags for metadata about this row. This only flag we're
        # tracking now is whether compression is on or not for the data column.
        flags = self.Flags(0)

        if self.compression:
            compression_flag, strategy = self.compression_strategies[self.compression]
            flags |= compression_flag
            value = strategy.encode(value)

            metrics.distribution(
                "storage.put.size",
                len(value),
                tags={"usecase": "nodestore", "compression": self.compression},
                unit="byte",
            )

        # Only need to write the column at all if any flags are enabled. And if
        # so, pack it into a single byte.
        if flags:
            mutations.append(
                SetCell(
                    self.column_family,
                    self.flags_column,
                    self.flags_struct.pack(flags),
                    timestamp_micros=ts_micros,
                )
            )

        assert len(value) <= self.max_size

        mutations.append(
            SetCell(self.column_family, self.data_column, value, timestamp_micros=ts_micros)
        )

        self._get_table().mutate_row(key, mutations)

    def delete(self, key: str) -> None:
        self._get_table().mutate_row(key, DeleteAllFromRow())

    def delete_many(self, keys: Sequence[str]) -> None:
        if not keys:
            return

        try:
            self._get_table().bulk_mutate_rows(
                [RowMutationEntry(key, DeleteAllFromRow()) for key in keys]
            )
        except MutationsExceptionGroup as e:
            raise BigtableError(list(e.exceptions)) from e

    def bootstrap(self, automatic_expiry: bool = True) -> None:
        table = self._get_admin_table()
        if table.exists():
            return

        # With automatic expiry, we set a GC rule to automatically delete rows
        # with an age of 0. This sounds odd, but when we write rows, we write
        # them with a future timestamp as long as a TTL is set during write. By
        # doing this, we are effectively writing rows into the future, and they
        # will be deleted due to TTL when their timestamp is passed.
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

    def destroy(self) -> None:
        table = self._get_admin_table()
        if not table.exists():
            return

        table.delete()
