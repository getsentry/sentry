from __future__ import annotations

import datetime as datetime_mod
from collections import namedtuple
from typing import Any, NamedTuple

from sentry.utils.dates import to_datetime

Notification = namedtuple(
    "Notification", "event rules notification_uuid", defaults=(None, None, None)
)


class Record(NamedTuple):
    key: str
    value: Any  # TODO: I think this is `Notification` ?
    timestamp: float

    @property
    def datetime(self) -> datetime_mod.datetime:
        return to_datetime(self.timestamp)
