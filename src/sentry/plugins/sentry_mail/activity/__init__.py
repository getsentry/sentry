from __future__ import absolute_import

from sentry.models import Activity

from .assigned import AssignedActivityEmail
from .note import NoteActivityEmail
from .release import ReleaseActivityEmail
from .regression import RegressionActivityEmail
from .resolved import ResolvedActivityEmail
from .resolved_in_release import ResolvedInReleaseActivityEmail
from .unassigned import UnassignedActivityEmail

emails = {
    Activity.ASSIGNED: AssignedActivityEmail,
    Activity.NOTE: NoteActivityEmail,
    Activity.RELEASE: ReleaseActivityEmail,
    Activity.SET_REGRESSION: RegressionActivityEmail,
    Activity.SET_RESOLVED: ResolvedActivityEmail,
    Activity.SET_RESOLVED_IN_RELEASE: ResolvedInReleaseActivityEmail,
    Activity.UNASSIGNED: UnassignedActivityEmail,
}
