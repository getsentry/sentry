from dataclasses import dataclass

from sentry.models.group import Group
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
    If the event has a user actor, skip their notification unless they've opted in for
    notifications about their own activity.
    """

    group: Group | None
    actor_user_id: int | None

    def get_targets(self) -> list[NotificationTarget]:
        if self.group is None:
            return []
        participant_map = get_participants_for_group(group=self.group, user_id=self.actor_user_id)
        return get_targets_from_participant_map(
            participant_map,
            organization_id=self.group.project.organization_id,
            project=self.group.project,
        )
