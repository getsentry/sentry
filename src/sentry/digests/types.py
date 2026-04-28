from __future__ import annotations

import datetime as datetime_mod
from collections.abc import Sequence
from enum import StrEnum
from typing import TYPE_CHECKING, NamedTuple

from sentry.utils.dates import to_datetime

if TYPE_CHECKING:
    from sentry.models.group import Group
    from sentry.models.rule import Rule
    from sentry.notifications.notifications.digest_types import (
        NotificationSerializedEvent,
        NotificationSerializedGroupEvent,
    )
    from sentry.services.eventstore.models import Event, GroupEvent


class IdentifierKey(StrEnum):
    RULE = "rule"
    WORKFLOW = "workflow"


class Notification(NamedTuple):
    event: Event | GroupEvent
    rules: Sequence[int] = ()
    notification_uuid: str | None = None
    identifier_key: IdentifierKey = IdentifierKey.RULE

    def with_rules(self, rules: list[Rule], group: Group) -> NotificationWithRuleObjects:
        from sentry.notifications.notifications.digest_types import (
            NotificationSerializedEvent,
            NotificationSerializedGroupEvent,
        )
        from sentry.services.eventstore.models import GroupEvent

        if isinstance(self.event, GroupEvent):
            serialized_event: NotificationSerializedEvent | NotificationSerializedGroupEvent = (
                NotificationSerializedGroupEvent.from_group_event(self.event)
            )
        else:
            serialized_event = NotificationSerializedEvent.from_event(self.event)

        return NotificationWithRuleObjects(
            event=serialized_event,
            rules=rules,
            notification_uuid=self.notification_uuid,
            group=group,
        )


class Record(NamedTuple):
    key: str
    value: Notification
    timestamp: float

    @property
    def datetime(self) -> datetime_mod.datetime:
        return to_datetime(self.timestamp)

    def with_rules(self, rules: list[Rule], group: Group) -> RecordWithRuleObjects:
        return RecordWithRuleObjects(
            key=self.key,
            value=self.value.with_rules(rules, group),
            timestamp=self.timestamp,
        )


class NotificationWithRuleObjects(NamedTuple):
    event: NotificationSerializedEvent | NotificationSerializedGroupEvent
    rules: list[Rule]
    notification_uuid: str | None
    group: Group


class RecordWithRuleObjects(NamedTuple):
    key: str
    value: NotificationWithRuleObjects
    timestamp: float

    @property
    def datetime(self) -> datetime_mod.datetime:
        return to_datetime(self.timestamp)
