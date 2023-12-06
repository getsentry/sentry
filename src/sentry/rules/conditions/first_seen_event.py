from datetime import datetime
from typing import Sequence

from sentry.eventstore.models import GroupEvent
from sentry.models.group import Group
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition
from sentry.types.condition_activity import ConditionActivity, ConditionActivityType


class FirstSeenEventCondition(EventCondition):
    id = "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"
    label = "A new issue is created"

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        # TODO(mgaeta): Bug: Rule is optional.
        if self.rule.environment_id is None:  # type: ignore
            return state.is_new
        else:
            return state.is_new_group_environment

    def get_activity(
        self, start: datetime, end: datetime, limit: int
    ) -> Sequence[ConditionActivity]:
        first_seen = (
            Group.objects.filter(project=self.project, first_seen__gte=start, first_seen__lt=end)
            .order_by("-first_seen")[:limit]
            .values_list("id", "first_seen")
        )
        return [
            ConditionActivity(
                group_id=g[0], type=ConditionActivityType.CREATE_ISSUE, timestamp=g[1]
            )
            for g in first_seen
        ]
