from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition
from sentry.services.eventstore.models import GroupEvent
from sentry.types.group import PriorityLevel


class NewHighPriorityIssueCondition(EventCondition):
    id = "sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition"
    label = "Sentry marks a new issue as high priority"

    def is_new(self, state: EventState) -> bool:
        if not self.rule or self.rule.environment_id is None:
            return state.is_new

        return state.is_new_group_environment

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        is_new = self.is_new(state)
        return is_new and event.group.priority == PriorityLevel.HIGH
