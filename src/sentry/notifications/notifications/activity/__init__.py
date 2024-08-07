from __future__ import annotations

from sentry.notifications.notifications.activity.assigned import AssignedActivityNotification
from sentry.notifications.notifications.activity.base import ActivityNotification
from sentry.notifications.notifications.activity.escalating import EscalatingActivityNotification
from sentry.notifications.notifications.activity.note import NoteActivityNotification
from sentry.notifications.notifications.activity.regression import RegressionActivityNotification
from sentry.notifications.notifications.activity.release import ReleaseActivityNotification
from sentry.notifications.notifications.activity.resolved import ResolvedActivityNotification
from sentry.notifications.notifications.activity.resolved_in_release import (
    ResolvedInReleaseActivityNotification,
)
from sentry.notifications.notifications.activity.unassigned import UnassignedActivityNotification
from sentry.types.activity import ActivityType

EMAIL_CLASSES_BY_TYPE: dict[int, type[ActivityNotification]] = {
    ActivityType.SET_RESOLVED.value: ResolvedActivityNotification,
    ActivityType.SET_REGRESSION.value: RegressionActivityNotification,
    ActivityType.NOTE.value: NoteActivityNotification,
    ActivityType.ASSIGNED.value: AssignedActivityNotification,
    ActivityType.UNASSIGNED.value: UnassignedActivityNotification,
    ActivityType.SET_RESOLVED_IN_RELEASE.value: ResolvedInReleaseActivityNotification,
    ActivityType.DEPLOY.value: ReleaseActivityNotification,
    ActivityType.SET_ESCALATING.value: EscalatingActivityNotification,
}
