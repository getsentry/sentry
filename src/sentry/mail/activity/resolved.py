from __future__ import absolute_import

from .base import ActivityEmail


class ResolvedActivityEmail(ActivityEmail):
    def get_activity_name(self):
        return "Resolved Issue"

    def get_description(self):
        return u"{author} marked {an issue} as resolved"
