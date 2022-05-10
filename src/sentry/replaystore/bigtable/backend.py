from __future__ import annotations

import os
import zlib
from datetime import datetime, timedelta
from typing import Any, List, Mapping, Optional, Tuple

from sentry.replaystore.base import ReplayDataType, ReplayNotFound, ReplayStore
from sentry.replaystore.bigtable.storage import ReplayBigtableStorage


class BigTableReplayStore(ReplayStore):
    store_class = ReplayBigtableStorage

    def __init__(
        self,
        project: str | None = None,
        instance: str = "sentry",
        table: str = "replaystore",
        automatic_expiry: bool = False,
        default_ttl: timedelta | None = None,
        compression: str | bool | None = None,
        **client_options: Optional[Mapping[Any, Any]],  # TODO: replace with bt ClientOptions type?
    ) -> None:

        bt_compression: str | None = None

        if compression is True:
            bt_compression = "zlib"
        elif compression is False:
            bt_compression = None

        self.store = self.store_class(
            project=project,
            instance=instance,
            table_name=table,
            default_ttl=default_ttl,
            compression=bt_compression,
            client_options=client_options,
        )
        self.automatic_expiry = automatic_expiry
        self.skip_deletes = automatic_expiry and "_SENTRY_CLEANUP" in os.environ

    def _get_rows(self, replay_id: str) -> List[Tuple[ReplayDataType, bytes]]:
        key = f"{replay_id}{self.KEY_DELIMETER}"
        rows_data = self.store.get_many_range_read(prefixes=[key])
        if not rows_data:
            raise ReplayNotFound

        parsed_rows_to_return = []
        for (rowkey, row_value) in rows_data:
            replay_data_type = self._get_row_type(rowkey)
            parsed_rows_to_return.append((replay_data_type, zlib.decompress(row_value)))
        return parsed_rows_to_return

    def _set_bytes(
        self,
        replay_init_id: str,
        replay_data_type: ReplayDataType,
        timestamp: datetime,
        data: bytes,
    ) -> None:
        key = self._row_key(replay_init_id, replay_data_type, timestamp)
        self.store.set(key, zlib.compress(data))

    def bootstrap(self) -> None:
        self.store.bootstrap(automatic_expiry=self.automatic_expiry)

    def _row_key(
        self, replay_init_id: str, replay_data_type: ReplayDataType, timestamp: datetime
    ) -> str:
        return self.KEY_DELIMETER.join(
            [replay_init_id, str(replay_data_type.value), str(timestamp.timestamp())]
        )

    def _get_row_type(self, key: str) -> ReplayDataType:
        return ReplayDataType(int(key.split(self.KEY_DELIMETER)[1]))
