import abc

from sentry.eventstore.models import GroupEvent
from sentry.rules.base import EventState, RuleBase


class EventCondition(RuleBase, abc.ABC):
    rule_type = "condition/event"

    @abc.abstractmethod
    def passes(self, event: GroupEvent, state: EventState) -> bool:
        pass
