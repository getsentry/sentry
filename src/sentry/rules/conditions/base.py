from __future__ import absolute_import, print_function

from sentry.rules.base import RuleBase


class RuleCategory:
    CONDITION = "condition"
    FILTER = "filter"


class EventCondition(RuleBase):
    rule_type = "condition/event"
    # category specifies a rule as a condition or filter
    category = RuleCategory.CONDITION

    def passes(self, event, state):
        raise NotImplementedError
