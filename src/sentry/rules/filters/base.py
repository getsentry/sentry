from typing import int
import abc

from sentry.rules.base import EventState, RuleBase
from sentry.services.eventstore.models import GroupEvent


class EventFilter(RuleBase, abc.ABC):
    rule_type = "filter/event"

    @abc.abstractmethod
    def passes(self, event: GroupEvent, state: EventState) -> bool:
        pass
