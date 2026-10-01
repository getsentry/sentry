from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition
from sentry.services.eventstore.models import GroupEvent
from sentry.types.group import PriorityLevel


class ExistingHighPriorityIssueCondition(EventCondition):
    id = "sentry.rules.conditions.high_priority_issue.ExistingHighPriorityIssueCondition"
    label = "Sentry marks an existing issue as high priority"

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        if state.is_new:
            return False

        return state.has_escalated and event.group.priority == PriorityLevel.HIGH
