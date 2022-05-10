from __future__ import annotations

import zlib
from datetime import datetime
from typing import List, Tuple

from sentry.replaystore.base import ReplayDataType, ReplayNotFound, ReplayStore
from sentry.replaystore.django.models import Replay


class DjangoReplayStore(ReplayStore):
    def _get_rows(self, replay_id: str) -> List[Tuple[ReplayDataType, bytes]]:
        data = Replay.objects.filter(replay_id=replay_id)
        if len(data) == 0:
            raise ReplayNotFound
        return [(row.replay_data_type, zlib.decompress(row.data)) for row in data]

    def _set_bytes(
        self,
        replay_id: str,
        replay_data_type: ReplayDataType,
        timestamp: datetime,
        data: bytes,
    ) -> None:
        Replay.objects.get_or_create(
            replay_id=replay_id,
            replay_data_type=replay_data_type,
            timestamp=timestamp,
            data=zlib.compress(data),
        )

    def bootstrap(self) -> None:
        # Nothing for Django backend to do during bootstrap
        pass
