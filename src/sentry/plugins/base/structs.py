from __future__ import annotations

__all__ = ("Notification",)

import warnings
from collections.abc import Sequence
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentry.notifications.types import NotificationOrigin
    from sentry.services.eventstore.models import Event, GroupEvent


class Notification:
    def __init__(
        self,
        event: Event | GroupEvent,
        rule: NotificationOrigin | None = None,
        rules: Sequence[NotificationOrigin] | None = None,
    ) -> None:
        if rule and not rules:
            rules = [rule]

        self.event = event
        self.rules = rules or []

    @property
    def rule(self) -> NotificationOrigin:
        warnings.warn(
            "Notification.rule is deprecated. Switch to Notification.rules.", DeprecationWarning
        )
        return self.rules[0]
