from sentry.notifications.activity.assigned import AssignedActivityNotification
from sentry.notifications.activity.new_processing_issues import (
    NewProcessingIssuesActivityNotification,
)
from sentry.notifications.activity.note import NoteActivityNotification
from sentry.notifications.activity.regression import RegressionActivityNotification
from sentry.notifications.activity.release import ReleaseActivityNotification
from sentry.notifications.activity.resolved import ResolvedActivityNotification
from sentry.notifications.activity.resolved_in_release import ResolvedInReleaseActivityNotification
from sentry.notifications.activity.unassigned import UnassignedActivityNotification
from sentry.types.activity import ActivityType

EMAIL_CLASSES_BY_TYPE = {
    ActivityType.ASSIGNED.value: AssignedActivityNotification,
    ActivityType.DEPLOY.value: ReleaseActivityNotification,
    ActivityType.NEW_PROCESSING_ISSUES.value: NewProcessingIssuesActivityNotification,
    ActivityType.NOTE.value: NoteActivityNotification,
    ActivityType.SET_REGRESSION.value: RegressionActivityNotification,
    ActivityType.SET_RESOLVED.value: ResolvedActivityNotification,
    ActivityType.SET_RESOLVED_IN_RELEASE.value: ResolvedInReleaseActivityNotification,
    ActivityType.UNASSIGNED.value: UnassignedActivityNotification,
}
