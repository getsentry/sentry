from __future__ import absolute_import

from .base import ActivityEmail


class UnassignedActivityEmail(ActivityEmail):
    def get_activity_name(self):
        return "Unassigned"

    def get_description(self):
        return u"{author} unassigned {an issue}"

    def get_category(self):
        return "unassigned_activity_email"
