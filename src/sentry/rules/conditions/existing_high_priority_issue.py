from collections.abc import Sequence
from datetime import datetime

from sentry.eventstore.models import GroupEvent
from sentry.models.activity import Activity
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition
from sentry.rules.conditions.new_high_priority_issue import has_high_priority_issue_alerts
from sentry.types.activity import ActivityType
from sentry.types.condition_activity import ConditionActivity, ConditionActivityType
from sentry.types.group import PriorityLevel


class ExistingHighPriorityIssueCondition(EventCondition):
    id = "sentry.rules.conditions.high_priority_issue.ExistingHighPriorityIssueCondition"
    label = "Sentry marks an existing issue as high priority"

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        if not has_high_priority_issue_alerts(self.project):
            return False

        if state.is_new:
            return False

        is_escalating = state.has_reappeared or state.has_escalated
        return is_escalating and event.group.priority == PriorityLevel.HIGH

    def get_activity(
        self, start: datetime, end: datetime, limit: int
    ) -> Sequence[ConditionActivity]:
        activities = (
            Activity.objects.filter(
                project=self.project,
                datetime__gte=start,
                datetime__lt=end,
                data={"priority": "high", "reason": "escalating"},
                type__in=[ActivityType.SET_PRIORITY.value],
                user_id=None,
            )
            .order_by("-datetime")[:limit]
            .values_list("group", "datetime", "data")
        )

        return [
            ConditionActivity(
                group_id=group_id,
                type=ConditionActivityType.EXISTING_HIGH_PRIORITY_ISSUE,
                timestamp=timestamp,
            )
            for group_id, timestamp, data in activities
            if group_id is not None
        ]
