from sentry.rules.base import RuleBase


class EventFilter(RuleBase):
    rule_type = "filter/event"

    def passes(self, event, state):
        raise NotImplementedError
