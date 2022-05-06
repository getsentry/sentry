from typing import Iterator, Sequence, Tuple

from google.cloud.bigtable.row_set import RowSet

from sentry.utils.kvstore.bigtable import BigtableKVStorage


# TODO: replace inheriting from Bigtable KV storage with our own tailored bigtable configuration
class ReplayBigtableStorage(BigtableKVStorage):
    def get_many_range_read(self, prefixes: Sequence[str] = ()) -> Iterator[Tuple[str, bytes]]:
        """
        Range reads needed for ReplayStore. almost the same as `get_many`.
        """
        rows = RowSet()
        for prefix in prefixes:
            rows.add_row_range_with_prefix(prefix)

        for row in self._get_table().read_rows(row_set=rows):
            # hack: use the mangled decode method
            value = self._BigtableKVStorage__decode_row(row)  # type: ignore
            if value is not None:
                yield row.row_key.decode("utf-8"), value
