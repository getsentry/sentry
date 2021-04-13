from .base import ActivityNotification


class UnassignedActivityNotification(ActivityNotification):
    def get_activity_name(self):
        return "Unassigned"

    def get_description(self):
        return "{author} unassigned {an issue}"

    def get_category(self):
        return "unassigned_activity_email"
