from __future__ import absolute_import

from sentry.rules.conditions.base import EventCondition


class EveryEventCondition(EventCondition):
    label = "The event occurs"

    def passes(self, event, state):
        return True

    def is_enabled(self):
        return False
