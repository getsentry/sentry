from __future__ import annotations

import datetime as datetime_mod
from collections import namedtuple
from collections.abc import MutableMapping
from typing import TYPE_CHECKING, TypeAlias

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


class Record(namedtuple("Record", "key value timestamp")):
    @property
    def datetime(self) -> datetime_mod.datetime | None:
        return to_datetime(self.timestamp)


ScheduleEntry = namedtuple("ScheduleEntry", "key timestamp")

OPTIONS = frozenset(("increment_delay", "maximum_delay", "minimum_delay"))

Digest: TypeAlias = MutableMapping["Rule", MutableMapping["Group", list[Record]]]


def get_option_key(plugin: str, option: str) -> str:
    assert option in OPTIONS
    return f"digests:{plugin}:{option}"
