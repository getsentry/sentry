from collections import namedtuple
from datetime import datetime
from typing import TYPE_CHECKING, Mapping, Optional, Sequence

from django.conf import settings

from sentry.utils.dates import to_datetime
from sentry.utils.services import LazyServiceWrapper

if TYPE_CHECKING:
    from sentry.models import Rule, Group

from .backends.base import Backend  # NOQA
from .backends.dummy import DummyBackend  # NOQA

backend = LazyServiceWrapper(
    Backend, settings.SENTRY_DIGESTS, settings.SENTRY_DIGESTS_OPTIONS, (DummyBackend,)
)
backend.expose(locals())


class Record(namedtuple("Record", "key value timestamp")):
    @property
    def datetime(self) -> Optional[datetime]:
        return to_datetime(self.timestamp)  # type: ignore


ScheduleEntry = namedtuple("ScheduleEntry", "key timestamp")

OPTIONS = frozenset(("increment_delay", "maximum_delay", "minimum_delay"))

Digest = Mapping["Rule", Mapping["Group", Sequence[Record]]]


def get_option_key(plugin: str, option: str) -> str:
    assert option in OPTIONS
    return f"digests:{plugin}:{option}"
