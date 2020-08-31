from __future__ import absolute_import, print_function

import os
import struct
from threading import Lock
from zlib import compress as zlib_compress, decompress as zlib_decompress

from google.cloud import bigtable
from google.cloud.bigtable.row_set import RowSet
from django.utils import timezone

from sentry.utils import json
from sentry.nodestore.base import NodeStorage


# Cache an instance of the encoder we want to use
json_dumps = json.JSONEncoder(
    separators=(",", ":"),
    skipkeys=False,
    ensure_ascii=True,
    check_circular=True,
    allow_nan=True,
    indent=None,
    encoding="utf-8",
    default=None,
).encode

json_loads = json._default_decoder.decode


_connection_lock = Lock()
_connection_cache = {}


def get_connection(project, instance, table, options):
    key = (project, instance, table)
    try:
        # Fast check for an existing connection cached
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


class BigtableNodeStorage(NodeStorage):
    """
    A Bigtable-based backend for storing node data.

    >>> BigtableNodeStorage(
    ...     project='some-project',
    ...     instance='sentry',
    ...     table='nodestore',
    ...     default_ttl=timedelta(days=30),
    ...     compression=True,
    ... )
    """

    max_size = 1024 * 1024 * 10
    column_family = b"x"
    ttl_column = b"t"
    flags_column = b"f"
    data_column = b"0"

    _FLAG_COMPRESSED = 1 << 0

    def __init__(
        self,
        project=None,
        instance="sentry",
        table="nodestore",
        automatic_expiry=False,
        default_ttl=None,
        compression=False,
        thread_pool_size=5,  # TODO(mattrobenolt): Remove this
        **kwargs
    ):
        self.project = project
        self.instance = instance
        self.table = table
        self.options = kwargs
        self.automatic_expiry = automatic_expiry
        self.default_ttl = default_ttl
        self.compression = compression
        self.skip_deletes = automatic_expiry and "_SENTRY_CLEANUP" in os.environ

    @property
    def connection(self):
        return get_connection(self.project, self.instance, self.table, self.options)

    def get(self, id):
        item_from_cache = self._get_cache_item(id)
        if item_from_cache:
            return item_from_cache

        data = self.decode_row(self.connection.read_row(id))
        self._set_cache_item(id, data)
        return data

    def get_multi(self, id_list):
        id_list = list(set(id_list))

        if len(id_list) == 1:
            return {id_list[0]: self.get(id_list[0])}

        cache_items = self._get_cache_items(id_list)

        if len(cache_items) == len(id_list):
            return cache_items

        uncached_ids = [id for id in id_list if id not in cache_items]
        rv = {}
        rows = RowSet()
        for id in uncached_ids:
            rows.add_row_key(id)
            rv[id] = None

        for row in self.connection.read_rows(row_set=rows):
            rv[row.row_key] = self.decode_row(row)
        self._set_cache_items(rv)
        rv.update(cache_items)
        return rv

    def decode_row(self, row):
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
            flags = struct.unpack("B", columns[self.flags_column][0].value)[0]

        # Check for a compression flag on, if so
        # decompress the data.
        if flags & self._FLAG_COMPRESSED:
            data = zlib_decompress(data)

        return json_loads(data)

    def set(self, id, data, ttl=None):
        row = self.encode_row(id, data, ttl)
        row.commit()
        self._set_cache_item(id, data)

    def encode_row(self, id, data, ttl=None):
        data = json_dumps(data)

        row = self.connection.row(id)
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
            ts = None
        else:
            ts = timezone.now() + ttl
            row.set_cell(
                self.column_family,
                self.ttl_column,
                struct.pack("<I", int(ttl.total_seconds())),
                timestamp=ts,
            )

        # Track flags for metadata about this row.
        # This only flag we're tracking now is whether compression
        # is on or not for the data column.
        flags = 0
        if self.compression:
            flags |= self._FLAG_COMPRESSED
            data = zlib_compress(data)

        # Only need to write the column at all if any flags
        # are enabled. And if so, pack it into a single byte.
        if flags:
            row.set_cell(
                self.column_family, self.flags_column, struct.pack("B", flags), timestamp=ts
            )

        assert len(data) <= self.max_size

        row.set_cell(self.column_family, self.data_column, data, timestamp=ts)
        return row

    def delete(self, id):
        if self.skip_deletes:
            return

        row = self.connection.row(id)
        row.delete()
        row.commit()
        self._delete_cache_item(id)

    def delete_multi(self, id_list):
        if self.skip_deletes:
            return

        if len(id_list) == 1:
            self.delete(id_list[0])
            return

        rows = []
        for id in id_list:
            row = self.connection.row(id)
            row.delete()
            rows.append(row)

        self.connection.mutate_rows(rows)
        self._delete_cache_items(id_list)

    def cleanup(self, cutoff_timestamp):
        raise NotImplementedError

    def bootstrap(self):
        table = (
            bigtable.Client(project=self.project, admin=True, **self.options)
            .instance(self.instance)
            .table(self.table)
        )
        if table.exists():
            return

        # With automatic expiry, we set a GC rule to automatically
        # delete rows with an age of 0. This sounds odd, but when
        # we write rows, we write them with a future timestamp as long
        # as a TTL is set during write. By doing this, we are effectively
        # writing rows into the future, and they will be deleted due to TTL
        # when their timestamp is passed.
        if self.automatic_expiry:
            from datetime import timedelta

            # NOTE: Bigtable can't actually use 0 TTL, and
            # requires a minimum value of 1ms.
            # > InvalidArgument desc = Error in field 'Modifications list' : Error in element #0 : max_age must be at least one millisecond
            delta = timedelta(milliseconds=1)
            gc_rule = bigtable.column_family.MaxAgeGCRule(delta)
        else:
            gc_rule = None

        from google.api_core import exceptions
        from google.api_core import retry

        retry_504 = retry.Retry(retry.if_exception_type(exceptions.DeadlineExceeded))
        retry_504(table.create)(column_families={self.column_family: gc_rule})
