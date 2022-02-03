from sentry.eventstore.models import Event
from sentry.rules.base import EventState, RuleBase


class EventFilter(RuleBase):
    rule_type = "filter/event"

    def passes(self, event: Event, state: EventState) -> bool:
        raise NotImplementedError
