from __future__ import absolute_import

from sentry.models import Activity

from .mail import ActivityMailDebugView


class DebugNoteEmailView(ActivityMailDebugView):
    def get_activity(self, request, event):
        return {
            'type': Activity.NOTE,
            'user': request.user,
            'data': {
                'text': 'This is an example note!',
            },
        }
