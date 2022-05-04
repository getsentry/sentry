from __future__ import annotations

from typing import List, Tuple

from sentry.replaystore.base import ReplayNotFound, ReplayStore
from sentry.replaystore.django.models import Replay
from sentry.utils.strings import compress


class DjangoReplayStore(ReplayStore):
    def _get_rows(self, key: str) -> List[Tuple[str, bytes]]:
        data = Replay.objects.filter(id__startswith=key)
        if len(data) == 0:
            raise ReplayNotFound
        return [(row.id, row.data) for row in data]

    def _set_bytes(self, key: str, value: bytes) -> None:
        replay = Replay.objects.create(id=key, data=compress(value))
        replay.save()

    def bootstrap(self) -> None:
        # Nothing for Django backend to do during bootstrap
        pass
