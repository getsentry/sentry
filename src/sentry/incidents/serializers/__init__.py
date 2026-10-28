from sentry.notifications.models.notificationaction import ActionTarget

__all__ = ("ACTION_TARGET_TYPE_TO_STRING",)

ACTION_TARGET_TYPE_TO_STRING = {
    ActionTarget.USER: "user",
    ActionTarget.TEAM: "team",
    ActionTarget.SPECIFIC: "specific",
    ActionTarget.SENTRY_APP: "sentry_app",
    ActionTarget.ISSUE_OWNERS: "issue_owners",
}
