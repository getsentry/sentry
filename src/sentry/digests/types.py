from __future__ import annotations

import datetime as datetime_mod
from collections.abc import Sequence
from enum import StrEnum
from typing import TYPE_CHECKING, NamedTuple

from sentry.utils.dates import to_datetime

if TYPE_CHECKING:
    from sentry.notifications.types import NotificationOrigin
    from sentry.services.eventstore.models import Event, GroupEvent


class IdentifierKey(StrEnum):
    RULE = "rule"
    WORKFLOW = "workflow"


class Notification(NamedTuple):
    event: Event | GroupEvent
    # Compatibility field: despite its name, this contains workflow IDs.
    rules: Sequence[int] = ()
    notification_uuid: str | None = None
    identifier_key: IdentifierKey = IdentifierKey.WORKFLOW
    # New records mirror `rules` here. Once all live data has both fields, readers should switch
    # to this field. When present, both fields must contain the same values.
    workflow_ids: Sequence[int] | None = None

    def with_rules(self, rules: list[NotificationOrigin]) -> NotificationWithRuleObjects:
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

    def with_rules(self, rules: list[NotificationOrigin]) -> RecordWithRuleObjects:
        return RecordWithRuleObjects(
            key=self.key,
            value=self.value.with_rules(rules),
            timestamp=self.timestamp,
        )


class NotificationWithRuleObjects(NamedTuple):
    event: Event | GroupEvent
    rules: list[NotificationOrigin]
    notification_uuid: str | None


class RecordWithRuleObjects(NamedTuple):
    key: str
    value: NotificationWithRuleObjects
    timestamp: float

    @property
    def datetime(self) -> datetime_mod.datetime:
        return to_datetime(self.timestamp)
