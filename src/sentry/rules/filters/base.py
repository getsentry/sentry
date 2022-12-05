import abc

from sentry.eventstore.models import GroupEvent
from sentry.rules.base import EventState, RuleBase


class EventFilter(RuleBase, abc.ABC):
    rule_type = "filter/event"

    @abc.abstractmethod
    def passes(self, event: GroupEvent, state: EventState) -> bool:
        pass
