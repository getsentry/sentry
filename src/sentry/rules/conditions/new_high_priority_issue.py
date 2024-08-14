from collections.abc import Sequence
from datetime import datetime

from sentry import features
from sentry.eventstore.models import GroupEvent
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition
from sentry.types.condition_activity import ConditionActivity, ConditionActivityType
from sentry.types.group import PriorityLevel


def has_high_priority_issue_alerts(project: Project) -> bool:
    # Seer-based priority is enabled if the organization has the feature flag
    return features.has("organizations:priority-ga-features", project.organization)


class NewHighPriorityIssueCondition(EventCondition):
    id = "sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition"
    label = "Sentry marks a new issue as high priority"

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

        return is_new and event.group.priority == PriorityLevel.HIGH

    def get_activity(
        self, start: datetime, end: datetime, limit: int
    ) -> Sequence[ConditionActivity]:
        first_seen = (
            Group.objects.filter(
                project=self.project,
                first_seen__gte=start,
                first_seen__lt=end,
                priority=PriorityLevel.HIGH,
            )
            .order_by("-first_seen")[:limit]
            .values_list("id", "first_seen")
        )
        return [
            ConditionActivity(
                group_id=g[0], type=ConditionActivityType.NEW_HIGH_PRIORITY_ISSUE, timestamp=g[1]
            )
            for g in first_seen
        ]
