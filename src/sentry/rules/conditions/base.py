import abc

from sentry.eventstore.models import Event
from sentry.rules.base import EventState, RuleBase


class EventCondition(RuleBase, abc.ABC):
    rule_type = "condition/event"

    def passes(self, event: Event, state: EventState) -> bool:
        raise NotImplementedError
