from __future__ import absolute_import

from sentry.models import Activity

from .mail import ActivityMailDebugView


class DebugUnassignedEmailView(ActivityMailDebugView):
    def get_activity(self, request, event):
        return {
            'type': Activity.UNASSIGNED,
            'user': request.user,
        }
