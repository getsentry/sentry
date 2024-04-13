import abc
from collections.abc import Sequence
from datetime import datetime
from typing import TypedDict

from sentry.eventstore.models import GroupEvent
from sentry.rules.base import EventState, RuleBase
from sentry.types.condition_activity import ConditionActivity


class GenericCondition(TypedDict):
    # the ID in the rules registry that maps to a condition class
    # e.g. "sentry.rules.conditions.every_event.EveryEventCondition"
    id: str


class EventCondition(RuleBase, abc.ABC):
    rule_type = "condition/event"

    @abc.abstractmethod
    def passes(self, event: GroupEvent, state: EventState) -> bool:
        pass

    def get_activity(
        self, start: datetime, end: datetime, limit: int
    ) -> Sequence[ConditionActivity]:
        raise NotImplementedError
