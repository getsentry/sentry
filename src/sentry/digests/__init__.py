from __future__ import annotations

import datetime as datetime_mod
from collections.abc import MutableMapping
from typing import TYPE_CHECKING, Any, NamedTuple, TypeAlias

from django.conf import settings

from sentry.utils.dates import to_datetime
from sentry.utils.services import LazyServiceWrapper

from .backends.base import Backend
from .backends.dummy import DummyBackend

if TYPE_CHECKING:
    from sentry.models.group import Group
    from sentry.models.rule import Rule

backend = LazyServiceWrapper(
    Backend, settings.SENTRY_DIGESTS, settings.SENTRY_DIGESTS_OPTIONS, (DummyBackend,)
)
backend.expose(locals())


class Record(NamedTuple):
    key: str
    value: Any  # TODO: I think this is `Notification` ?
    timestamp: float

    @property
    def datetime(self) -> datetime_mod.datetime:
        return to_datetime(self.timestamp)


class ScheduleEntry(NamedTuple):
    key: str
    timestamp: float


OPTIONS = frozenset(("increment_delay", "maximum_delay", "minimum_delay"))

Digest: TypeAlias = MutableMapping["Rule", MutableMapping["Group", list[Record]]]


def get_option_key(plugin: str, option: str) -> str:
    assert option in OPTIONS
    return f"digests:{plugin}:{option}"
