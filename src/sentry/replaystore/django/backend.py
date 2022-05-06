from __future__ import annotations

from datetime import datetime
from typing import List, Tuple

from sentry.replaystore.base import ReplayDataType, ReplayNotFound, ReplayStore
from sentry.replaystore.django.models import Replay
from sentry.utils.strings import compress


class DjangoReplayStore(ReplayStore):
    def _get_rows(self, replay_id: str) -> List[Tuple[ReplayDataType, bytes]]:
        data = Replay.objects.filter(replay_id=replay_id)
        if len(data) == 0:
            raise ReplayNotFound
        return [(row.replay_data_type, row.data) for row in data]

    def _set_bytes(
        self,
        replay_id: str,
        replay_data_type: ReplayDataType,
        timestamp: datetime,
        data: bytes,
    ) -> None:
        replay = Replay.objects.create(
            replay_id=replay_id,
            replay_data_type=replay_data_type,
            timestamp=timestamp,
            data=compress(data),
        )
        replay.save()

    def bootstrap(self) -> None:
        # Nothing for Django backend to do during bootstrap
        pass
