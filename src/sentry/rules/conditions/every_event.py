from sentry.eventstore.models import Event
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition


class EveryEventCondition(EventCondition):
    label = "The event occurs"

    def passes(self, event: Event, state: EventState) -> bool:
        return True

    def is_enabled(self) -> bool:
        return False
