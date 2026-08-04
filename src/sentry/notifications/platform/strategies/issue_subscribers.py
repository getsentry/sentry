from dataclasses import dataclass

from sentry.models.activity import Activity
from sentry.notifications.platform.strategies.utils import get_targets_from_participant_map
from sentry.notifications.platform.types import (
    NotificationStrategy,
    NotificationTarget,
)
from sentry.notifications.utils.participants import get_participants_for_group


@dataclass(frozen=True)
class IssueSubscribersActivityStrategy(NotificationStrategy):
    """
    Strategy for issue workflow notifications.
    Targets all the subscribers for a given issue attached to an activity.
    If there is a user associated with the activity, skip their notification unless they've opted in for
    notifications about their own activity.
    """

    activity: Activity

    def get_targets(self) -> list[NotificationTarget]:
        group = self.activity.group
        if not group:
            return []
        participant_map = get_participants_for_group(group=group, user_id=self.activity.user_id)
        return get_targets_from_participant_map(
            participant_map, organization_id=group.project.organization_id
        )
