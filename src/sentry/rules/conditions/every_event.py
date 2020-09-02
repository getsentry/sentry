from __future__ import absolute_import

from sentry.rules.conditions.base import EventCondition


class EveryEventCondition(EventCondition):
    label = "An event occurs"

    def passes(self, event, state):
        return True
