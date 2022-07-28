import enum
import logging
import struct
from datetime import timedelta
from threading import Lock
from typing import Any, Iterator, Mapping, Optional, Sequence, Tuple, cast

from django.utils import timezone
from google.api_core import exceptions, retry
from google.cloud import bigtable
from google.cloud.bigtable.row_data import PartialRowData
from google.cloud.bigtable.row_set import RowSet
from google.cloud.bigtable.table import Table

from sentry.utils.codecs import Codec, ZlibCodec, ZstdCodec
from sentry.utils.kvstore.abstract import KVStorage

logger = logging.getLogger(__name__)


class BigtableError(Exception):
    pass


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

    compression_strategies: Mapping[str, Tuple[Flags, Codec[bytes, bytes]]] = {
        "zlib": (Flags.COMPRESSED_ZLIB, ZlibCodec()),
        "zstd": (Flags.COMPRESSED_ZSTD, ZstdCodec()),
    }

    def __init__(
        self,
        instance: str,
        table_name: str,
        project: Optional[str] = None,
        client_options: Optional[Mapping[Any, Any]] = None,
        default_ttl: Optional[timedelta] = None,
        compression: Optional[str] = None,
        app_profile: Optional[str] = None,
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

        self.__table: Table
        self.__table_lock = Lock()

    def _get_table(self, admin: bool = False) -> Table:
        if admin is True:
            return (
                bigtable.Client(project=self.project, admin=True, **self.client_options)
                .instance(self.instance)
                .table(self.table_name, app_profile_id=self.app_profile)
            )

        try:
            # Fast check for an existing table
            return self.__table
        except AttributeError:
            # If missing, we acquire our lock to initialize a new one
            with self.__table_lock:
                # It's possible that the lock was blocked waiting on someone
                # else who already initialized, so we first check again to make
                # sure this isn't the case.
                try:
                    table = self.__table
                except AttributeError:
                    table = self.__table = (
                        bigtable.Client(project=self.project, **self.client_options)
                        .instance(self.instance)
                        .table(self.table_name, app_profile_id=self.app_profile)
                    )
            return table

    def get(self, key: str) -> Optional[bytes]:
        row = self._get_table().read_row(key)
        if row is None:
            return None

        return self.__decode_row(row)

    def get_many(self, keys: Sequence[str]) -> Iterator[Tuple[str, bytes]]:
        rows = RowSet()
        for key in keys:
            rows.add_row_key(key)

        for row in self._get_table().read_rows(row_set=rows):
            value = self.__decode_row(row)

            # Even though Bigtable in't going to return empty rows, an empty
            # value may be returned by ``__decode_row`` if the the row has
            # outlived its TTL, so we need to check its value here.
            if value is not None:
                yield row.row_key.decode("utf-8"), value

    def __decode_row(self, row: PartialRowData) -> Optional[bytes]:
        columns = row.cells[self.column_family]

        try:
            cell = columns[self.data_column][0]
        except KeyError:
            logger.warning("Retrieved row (%r) which does not contain a data column!", row.row_key)
            return None

        # Check if a TTL column exists for this row. If there is, we can use
        # the `timestamp` property of the cells to see if we should return the
        # row or not.
        if self.ttl_column in columns:
            # NOTE: If you need the value, it can be unpacked with the struct.
            if cell.timestamp < timezone.now():
                return None

        value = cast(bytes, cell.value)

        if self.flags_column in columns:
            flags = self.Flags(self.flags_struct.unpack(columns[self.flags_column][0].value)[0])

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

    def set(self, key: str, value: bytes, ttl: Optional[timedelta] = None) -> None:
        # XXX: There is a type mismatch here -- ``direct_row`` expects
        # ``bytes`` but we are providing it with ``str``.
        row = self._get_table().direct_row(key)

        # Call to delete is just a state mutation, and in this case is just
        # used to clear all columns so the entire row will be replaced.
        # Otherwise, if an existing row were mutated, and it took up more than
        # one column, it'd be possible to overwrite beginning columns and still
        # retain the end ones. This also ensures old data is collected during
        # garbage collection, as well ensuring that TTL mutation is respected,
        # particularly if the TTL is reduced (if the prior state was retained,
        # cell values would persist using the longest TTL, not the most
        # recently set TTL.)
        row.delete()

        # If we are setting a TTL on this row, we want to set the timestamp of
        # the cells into the future. This allows our GC policy to delete them
        # when the time comes. It also allows us to filter the rows on read if
        # we are past the timestamp to not return. We want to set a ttl column
        # to the ttl value in the future if we wanted to bump the timestamp and
        # rewrite a row with a new ttl.
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

        # Track flags for metadata about this row. This only flag we're
        # tracking now is whether compression is on or not for the data column.
        flags = self.Flags(0)

        if self.compression:
            compression_flag, strategy = self.compression_strategies[self.compression]
            flags |= compression_flag
            value = strategy.encode(value)

        # Only need to write the column at all if any flags are enabled. And if
        # so, pack it into a single byte.
        if flags:
            row.set_cell(
                self.column_family,
                self.flags_column,
                self.flags_struct.pack(flags),
                timestamp=ts,
            )

        assert len(value) <= self.max_size

        row.set_cell(self.column_family, self.data_column, value, timestamp=ts)

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
        table = self._get_table(admin=True)
        if not table.exists():
            return

        table.delete()
