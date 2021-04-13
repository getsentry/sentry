from .base import ActivityNotification


class ResolvedActivityNotification(ActivityNotification):
    def get_activity_name(self):
        return "Resolved Issue"

    def get_description(self):
        return "{author} marked {an issue} as resolved"

    def get_category(self):
        return "resolved_activity_email"
