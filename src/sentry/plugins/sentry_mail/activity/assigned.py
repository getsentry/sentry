from __future__ import absolute_import

import six

from sentry.models import User

from .base import ActivityEmail


class AssignedActivityEmail(ActivityEmail):
    def get_activity_name(self):
        return 'Assigned'

    def get_description(self):
        activity = self.activity
        data = activity.data
        if activity.user_id and six.text_type(activity.user_id) == data['assignee']:
            return u'{author} assigned {an issue} to themselves'

        try:
            assignee = User.objects.get_from_cache(id=data['assignee'])
        except User.DoesNotExist:
            pass
        else:
            return u'{author} assigned {an issue} to {assignee}', {
                'assignee': assignee.get_display_name(),
            }

        if data.get('assigneeEmail'):
            return u'{author} assigned {an issue} to {assignee}', {
                'assignee': data['assigneeEmail'],
            }

        return u'{author} assigned {an issue} to an unknown user'
