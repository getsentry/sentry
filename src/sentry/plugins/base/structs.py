from __future__ import annotations

__all__ = ("Notification",)

import warnings
from collections.abc import Sequence
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentry.models.rule import Rule
    from sentry.notifications.types import NotificationOrigin
    from sentry.services.eventstore.models import Event, GroupEvent


class Notification:
    def __init__(
        self,
        event: Event | GroupEvent,
        rule: Rule | NotificationOrigin | None = None,
        rules: Sequence[Rule | NotificationOrigin] | None = None,
    ) -> None:
        if rule and not rules:
            rules = [rule]

        self.event = event
        self.rules = list(rules or [])

    @property
    def rule(self) -> Rule | NotificationOrigin:
        warnings.warn(
            "Notification.rule is deprecated. Switch to Notification.rules.", DeprecationWarning
        )
        return self.rules[0]
