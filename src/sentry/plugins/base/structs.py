from __future__ import annotations

__all__ = ("Annotation", "Notification")

import warnings
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentry.eventstore.models import GroupEvent


class Annotation:
    def __init__(self, label, url=None, description=None):
        self.label = label
        self.url = url
        self.description = description


class Notification:
    def __init__(self, event: GroupEvent, rule=None, rules=None):
        if rule and not rules:
            rules = [rule]

        self.event = event
        self.rules = rules or []

    @property
    def rule(self):
        warnings.warn(
            "Notification.rule is deprecated. Switch to Notification.rules.", DeprecationWarning
        )
        return self.rules[0]
