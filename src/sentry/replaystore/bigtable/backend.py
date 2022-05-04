from __future__ import annotations

import os
from datetime import timedelta
from typing import Any, Dict, List, Tuple

from sentry.replaystore.base import ReplayNotFound, ReplayStore
from sentry.utils.kvstore.bigtable import BigtableKVStorage
from sentry.utils.strings import compress


class BigTableReplayStore(ReplayStore):
    store_class = BigtableKVStorage

    def __init__(
        self,
        project: str | None = None,
        instance: str = "sentry",
        table: str = "replaystore",
        automatic_expiry: bool = False,
        default_ttl: timedelta | None = None,
        compression: str | bool | None = None,
        **client_options: Dict[Any, Any],
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

    def _get_rows(self, key: str) -> List[Tuple[str, bytes]]:
        data = list(self.store.get_many_range_read(prefixes=[key]))
        if len(data) == 0:
            raise ReplayNotFound
        return data

    def _set_bytes(self, key: str, value: bytes) -> None:
        self.store.set(key, compress(value))

    def bootstrap(self) -> None:
        self.store.bootstrap(automatic_expiry=self.automatic_expiry)
