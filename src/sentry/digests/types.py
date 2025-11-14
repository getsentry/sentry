from __future__ import annotations

import datetime as datetime_mod
from collections.abc import Sequence
from enum import StrEnum
from typing import TYPE_CHECKING, NamedTuple, int

from sentry.utils.dates import to_datetime

if TYPE_CHECKING:
    from sentry.models.rule import Rule
    from sentry.services.eventstore.models import Event, GroupEvent


class IdentifierKey(StrEnum):
    RULE = "rule"
    WORKFLOW = "workflow"


class Notification(NamedTuple):
    event: Event | GroupEvent
    rules: Sequence[int] = ()
    notification_uuid: str | None = None
    identifier_key: IdentifierKey = IdentifierKey.RULE

    def with_rules(self, rules: list[Rule]) -> NotificationWithRuleObjects:
        return NotificationWithRuleObjects(
            event=self.event,
            rules=rules,
            notification_uuid=self.notification_uuid,
            # We don't really worry about identifier_key here since this method is not used after we pop record from redis
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
    event: Event | GroupEvent
    rules: list[Rule]
    notification_uuid: str | None


class RecordWithRuleObjects(NamedTuple):
    key: str
    value: NotificationWithRuleObjects
    timestamp: float

    @property
    def datetime(self) -> datetime_mod.datetime:
        return to_datetime(self.timestamp)
