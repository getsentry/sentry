from __future__ import annotations

import datetime as datetime_mod
from collections.abc import Sequence
from typing import TYPE_CHECKING, NamedTuple

from sentry.utils.dates import to_datetime

if TYPE_CHECKING:
    from sentry.eventstore.models import Event
    from sentry.models.rule import Rule


class Notification(NamedTuple):
    event: Event
    rules: Sequence[int] = ()
    notification_uuid: str | None = None

    def with_rules(self, rules: list[Rule]) -> NotificationWithRuleObjects:
        return NotificationWithRuleObjects(
            event=self.event,
            rules=rules,
            notification_uuid=self.notification_uuid,
        )


class Record(NamedTuple):
    key: str
    value: Notification
    timestamp: float

    @property
    def datetime(self) -> datetime_mod.datetime:
        return to_datetime(self.timestamp)

    def with_rules(self, rules: list[Rule]) -> RecordWithRuleObjects:
        return RecordWithRuleObjects(
            key=self.key,
            value=self.value.with_rules(rules),
            timestamp=self.timestamp,
        )


class NotificationWithRuleObjects(NamedTuple):
    event: Event
    rules: list[Rule]
    notification_uuid: str | None


class RecordWithRuleObjects(NamedTuple):
    key: str
    value: NotificationWithRuleObjects
    timestamp: float

    @property
    def datetime(self) -> datetime_mod.datetime:
        return to_datetime(self.timestamp)
