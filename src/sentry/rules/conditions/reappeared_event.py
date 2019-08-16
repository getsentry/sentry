from __future__ import absolute_import

from sentry.rules.conditions.base import EventCondition


class ReappearedEventCondition(EventCondition):
    label = "An issue changes state from ignored to unresolved"

    def passes(self, event, state):
        return state.has_reappeared
