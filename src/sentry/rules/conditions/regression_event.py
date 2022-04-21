from sentry.eventstore.models import Event
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition


class RegressionEventCondition(EventCondition):
    id = "sentry.rules.conditions.regression_event.RegressionEventCondition"
    label = "The issue changes state from resolved to unresolved"

    def passes(self, event: Event, state: EventState) -> bool:
        return state.is_regression
