from __future__ import annotations

from dataclasses import dataclass

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.platform.strategies.utils import get_targets_from_participant_map
from sentry.notifications.platform.types import (
    NotificationStrategy,
    NotificationTarget,
)
from sentry.notifications.utils.participants import get_participants_for_release


@dataclass(frozen=True)
class DeployReleaseStrategy(NotificationStrategy):
    projects: frozenset[Project]
    organization: Organization
    committer_user_ids: frozenset[int]

    def get_targets(self) -> list[NotificationTarget]:
        participant_map = get_participants_for_release(
            projects=self.projects,
            organization=self.organization,
            commited_user_ids=set(self.committer_user_ids),
        )
        return get_targets_from_participant_map(
            participant_map, organization_id=self.organization.id
        )
