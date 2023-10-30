from sentry.eventstore.models import GroupEvent
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition


class EveryEventCondition(EventCondition):
    id = "sentry.rules.conditions.every_event.EveryEventCondition"
    label = "The event occurs"

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        return True

    def is_enabled(self) -> bool:
        return False
