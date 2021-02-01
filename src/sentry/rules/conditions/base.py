from sentry.rules.base import RuleBase


class EventCondition(RuleBase):
    rule_type = "condition/event"

    def passes(self, event, state):
        raise NotImplementedError
