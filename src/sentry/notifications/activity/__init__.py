from sentry.notifications.activity.assigned import AssignedActivityEmail
from sentry.notifications.activity.new_processing_issues import NewProcessingIssuesActivityEmail
from sentry.notifications.activity.note import NoteActivityEmail
from sentry.notifications.activity.regression import RegressionActivityEmail
from sentry.notifications.activity.release import ReleaseActivityEmail
from sentry.notifications.activity.resolved import ResolvedActivityEmail
from sentry.notifications.activity.resolved_in_release import ResolvedInReleaseActivityEmail
from sentry.notifications.activity.unassigned import UnassignedActivityEmail
from sentry.types.activity import ActivityType

EMAIL_CLASSES_BY_TYPE = {
    ActivityType.ASSIGNED.value: AssignedActivityEmail,
    ActivityType.DEPLOY.value: ReleaseActivityEmail,
    ActivityType.NEW_PROCESSING_ISSUES.value: NewProcessingIssuesActivityEmail,
    ActivityType.NOTE.value: NoteActivityEmail,
    ActivityType.SET_REGRESSION.value: RegressionActivityEmail,
    ActivityType.SET_RESOLVED.value: ResolvedActivityEmail,
    ActivityType.SET_RESOLVED_IN_RELEASE.value: ResolvedInReleaseActivityEmail,
    ActivityType.UNASSIGNED.value: UnassignedActivityEmail,
}
