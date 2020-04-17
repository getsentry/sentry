from __future__ import absolute_import

from sentry.mail.activity.assigned import AssignedActivityEmail
from sentry.mail.activity.new_processing_issues import NewProcessingIssuesActivityEmail
from sentry.mail.activity.note import NoteActivityEmail
from sentry.mail.activity.regression import RegressionActivityEmail
from sentry.mail.activity.release import ReleaseActivityEmail
from sentry.mail.activity.resolved import ResolvedActivityEmail
from sentry.mail.activity.resolved_in_release import ResolvedInReleaseActivityEmail
from sentry.mail.activity.unassigned import UnassignedActivityEmail
from sentry.models.activity import Activity

emails = {
    Activity.ASSIGNED: AssignedActivityEmail,
    Activity.NOTE: NoteActivityEmail,
    Activity.DEPLOY: ReleaseActivityEmail,
    Activity.SET_REGRESSION: RegressionActivityEmail,
    Activity.SET_RESOLVED: ResolvedActivityEmail,
    Activity.SET_RESOLVED_IN_RELEASE: ResolvedInReleaseActivityEmail,
    Activity.UNASSIGNED: UnassignedActivityEmail,
    Activity.NEW_PROCESSING_ISSUES: NewProcessingIssuesActivityEmail,
}
