from __future__ import absolute_import

import six

from sentry.models import Activity

from .mail import ActivityMailDebugView


class DebugAssignedEmailView(ActivityMailDebugView):
    def get_activity(self, request, event):
        return {
            "type": Activity.ASSIGNED,
            "user": request.user,
            "data": {
                "assignee": "10000000",
                "assigneeEmail": "foo@example.com",
                "assigneeType": "user",
            },
        }


class DebugSelfAssignedEmailView(ActivityMailDebugView):
    def get_activity(self, request, event):
        return {
            "type": Activity.ASSIGNED,
            "user": request.user,
            "data": {
                "assignee": six.text_type(request.user.id),
                "assigneeEmail": request.user.email,
                "assigneeType": "user",
            },
        }


class DebugSelfAssignedTeamEmailView(ActivityMailDebugView):
    def get_activity(self, request, event):
        return {
            "type": Activity.ASSIGNED,
            "user": request.user,
            "data": {"assignee": "1", "assigneeEmail": None, "assigneeType": "team"},
        }
