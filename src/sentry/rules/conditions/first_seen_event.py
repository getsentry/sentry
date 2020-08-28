from __future__ import absolute_import

from sentry.rules.conditions.base import EventCondition


class FirstSeenEventCondition(EventCondition):
    label = "The issue is first seen"

    def passes(self, event, state):
        if self.rule.environment_id is None:
            return state.is_new
        else:
            return state.is_new_group_environment
