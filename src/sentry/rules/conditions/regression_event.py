from __future__ import absolute_import

from sentry.rules.conditions.base import EventCondition


class RegressionEventCondition(EventCondition):
    label = "The issue changes state from resolved to unresolved"

    def passes(self, event, state):
        return state.is_regression
