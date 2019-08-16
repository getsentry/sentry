from __future__ import absolute_import

from sentry.rules.conditions.base import EventCondition


class EveryEventCondition(EventCondition):
    label = "An event is seen"

    def passes(self, event, state):
        return True
