import abc

from sentry.eventstore.models import GroupEvent
from sentry.rules.base import EventState, RuleBase
from sentry.types.condition_activity import ConditionActivity


class EventFilter(RuleBase, abc.ABC):
    rule_type = "filter/event"

    @abc.abstractmethod
    def passes(self, event: GroupEvent, state: EventState) -> bool:
        pass

    def passes_activity(self, condition_activity: ConditionActivity) -> bool:
        raise NotImplementedError
