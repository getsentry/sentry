import abc
from typing import TypedDict

from sentry.rules.base import EventState, RuleBase
from sentry.services.eventstore.models import GroupEvent


class GenericCondition(TypedDict):
    # the ID in the rules registry that maps to a condition class
    # e.g. "sentry.rules.conditions.every_event.EveryEventCondition"
    id: str


class EventCondition(RuleBase, abc.ABC):
    rule_type = "condition/event"

    @abc.abstractmethod
    def passes(self, event: GroupEvent, state: EventState) -> bool:
        pass
