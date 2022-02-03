from sentry.eventstore.models import Event
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition


class FirstSeenEventCondition(EventCondition):
    label = "A new issue is created"

    def passes(self, event: Event, state: EventState) -> bool:
        # TODO(mgaeta): Bug: Rule is optional.
        if self.rule.environment_id is None:  # type: ignore
            return state.is_new
        else:
            return state.is_new_group_environment
