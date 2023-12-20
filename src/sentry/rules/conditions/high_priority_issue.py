from datetime import datetime
from typing import Optional, Sequence

from sentry.eventstore.models import GroupEvent
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.receivers.rules import has_high_priority_issue_alerts
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition
from sentry.types.activity import ActivityType
from sentry.types.condition_activity import ConditionActivity, ConditionActivityType

HIGH_SEVERITY_THRESHOLD = 0.1


class HighPriorityIssueCondition(EventCondition):
    id = "sentry.rules.conditions.high_priority_issue.HighPriorityIssueCondition"
    label = "Sentry marks an issue as high priority"

    def is_new_high_severity(self, state: EventState, group: Optional[Group]) -> bool:
        if not group or not state.is_new:
            return False

        try:
            severity = float(group.get_event_metadata().get("severity", ""))
        except (KeyError, TypeError, ValueError):
            return False

        return severity >= HIGH_SEVERITY_THRESHOLD

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        if not has_high_priority_issue_alerts(self.project):
            return False

        is_new_high_severity = self.is_new_high_severity(state, event.group)
        is_escalating = state.has_reappeared or state.has_escalated

        return is_new_high_severity or is_escalating

    def get_activity(
        self, start: datetime, end: datetime, limit: int
    ) -> Sequence[ConditionActivity]:
        # reappearances are recorded as SET_UNRESOLVED with no user
        activities = (
            Activity.objects.filter(
                project=self.project,
                datetime__gte=start,
                datetime__lt=end,
                type__in=[ActivityType.SET_UNRESOLVED.value, ActivityType.SET_ESCALATING.value],
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
