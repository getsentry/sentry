__all__ = ("Annotation", "Notification")

import warnings


class Annotation:
    def __init__(self, label, url=None, description=None):
        self.label = label
        self.url = url
        self.description = description


class Notification:
    def __init__(self, event, rule=None, rules=None):
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
