from datetime import datetime
from typing import Optional, Sequence

from sentry import features
from sentry.eventstore.models import GroupEvent
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition
from sentry.types.activity import ActivityType
from sentry.types.condition_activity import ConditionActivity, ConditionActivityType

HIGH_SEVERITY_THRESHOLD = 0.1


class HighPriorityIssueCondition(EventCondition):
    id = "sentry.rules.conditions.high_priority_issue.HighPriorityIssueCondition"
    label = "Sentry marks an issue as high priority"

    def is_high_severity(self, state: EventState, group: Optional[Group]) -> bool:
        if not group:
            return False

        try:
            severity = float(group.get_event_metadata().get("severity", ""))
        except (KeyError, TypeError, ValueError):
            return False

        return severity >= HIGH_SEVERITY_THRESHOLD

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        has_issue_priority_alerts = features.has("projects:high-priority-alerts", self.project)
        if not has_issue_priority_alerts:
            return False

        is_high_severity = self.is_high_severity(state, event.group)
        is_escalating = state.has_reappeared or state.has_escalated

        return is_high_severity or is_escalating

    def get_activity(
        self, start: datetime, end: datetime, limit: int
    ) -> Sequence[ConditionActivity]:
        # reappearances are recorded as SET_UNRESOLVED with no user
        activities = (
            Activity.objects.filter(
                project=self.project,
                datetime__gte=start,
                datetime__lt=end,
                type=ActivityType.SET_UNRESOLVED.value,
                user_id=None,
            )
            .order_by("-datetime")[:limit]
            .values_list("group", "datetime", "data")
        )

        return [
            ConditionActivity(
                group_id=a[0], type=ConditionActivityType.REAPPEARED, timestamp=a[1], data=a[2]
            )
            for a in activities
        ]
