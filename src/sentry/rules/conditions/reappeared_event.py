from sentry.eventstore.models import Event
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition


class ReappearedEventCondition(EventCondition):
    id = "sentry.rules.conditions.reappeared_event.ReappearedEventCondition"
    label = "The issue changes state from ignored to unresolved"

    def passes(self, event: Event, state: EventState) -> bool:
        return state.has_reappeared
