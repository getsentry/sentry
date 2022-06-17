from sentry.eventstore.models import Event
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition


class ActiveReleaseEventCondition(EventCondition):
    id = "sentry.rules.conditions.active_release.ActiveReleaseEventCondition"
    label = "A new issue is created within an active release (1 hour of deployment)"

    def passes(self, event: Event, state: EventState) -> bool:
        if self.rule.environment_id is None:  # type: ignore
            return state.is_new and state.is_in_active_release
        else:
            return state.is_new_group_environment and state.is_in_active_release
