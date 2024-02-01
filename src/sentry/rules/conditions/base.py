import abc
from datetime import datetime
from typing import Sequence

from sentry.eventstore.models import GroupEvent
from sentry.rules.base import EventState, RuleBase
from sentry.types.condition_activity import ConditionActivity


class EventCondition(RuleBase, abc.ABC):
    rule_type = "condition/event"

    @abc.abstractmethod
    def passes(self, event: GroupEvent, state: EventState) -> bool:
        pass

    def get_activity(
        self, start: datetime, end: datetime, limit: int
    ) -> Sequence[ConditionActivity]:
        raise NotImplementedError
