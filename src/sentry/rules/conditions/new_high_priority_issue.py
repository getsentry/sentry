from collections.abc import Sequence
from datetime import datetime

from sentry import features
from sentry.event_manager import HIGH_SEVERITY_THRESHOLD
from sentry.eventstore.models import GroupEvent
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.receivers.rules import has_high_priority_issue_alerts
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition
from sentry.types.activity import ActivityType
from sentry.types.condition_activity import ConditionActivity, ConditionActivityType
from sentry.types.group import PriorityLevel


class NewHighPriorityIssueCondition(EventCondition):
    id = "sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition"
    label = "Sentry marks a new issue as high priority"

    # This is legacy code that should not be used since "projects:issue-priority" is enabled.
    # TODO(snigdha): Remove this when the flag is removed.
    def is_new_high_severity(self, state: EventState, group: Group) -> bool:
        try:
            severity = float(group.get_event_metadata().get("severity", ""))
        except (KeyError, TypeError, ValueError):
            return False

        return severity >= HIGH_SEVERITY_THRESHOLD

    def is_new(self, state: EventState) -> bool:
        if not self.rule or self.rule.environment_id is None:
            return state.is_new

        return state.is_new_group_environment

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        if not has_high_priority_issue_alerts(self.project):
            return False

        is_new = self.is_new(state)
        if not event.project.flags.has_high_priority_alerts:
            return is_new

        if features.has("projects:issue-priority", self.project):
            return is_new and event.group.priority == PriorityLevel.HIGH

        is_new_high_severity = self.is_new_high_severity(state, event.group)
        return is_new and is_new_high_severity

    def get_activity(
        self, start: datetime, end: datetime, limit: int
    ) -> Sequence[ConditionActivity]:
        # reappearances are recorded as SET_UNRESOLVED with no user
        activities = (
            Activity.objects.filter(
                project=self.project,
                datetime__gte=start,
                datetime__lt=end,
                type__in=[ActivityType.SET_UNRESOLVED.value],
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
