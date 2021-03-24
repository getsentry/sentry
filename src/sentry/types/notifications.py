from enum import Enum

"""
TODO(postgres): We've encoded these enums as integers to facilitate
communication with the DB. We'd prefer to encode them as strings to facilitate
communication with the API and plan to do so as soon as we use native enums in
Postgres. In the meantime each enum has an adjacent object that maps the
integers to their string values.
"""


class NotificationSettingTypes(Enum):
    """
    Each of these categories of Notification settings has at least an option for
    "on" or "off". Workflow also includes SUBSCRIBE_ONLY and Deploy also
    includes COMMITTED_ONLY and both of these values are described below.
    """

    # Control all notification types. Currently unused.
    DEFAULT = 0

    # When Sentry sees there is a new code deploy.
    DEPLOY = 10

    # When Sentry sees and issue that triggers an Alert Rule.
    ISSUE_ALERTS = 20

    # Notifications for changes in assignment, resolution, comments, etc.
    WORKFLOW = 30


NOTIFICATION_SETTING_TYPES = {
    NotificationSettingTypes.DEFAULT: "default",
    NotificationSettingTypes.DEPLOY: "deploy",
    NotificationSettingTypes.ISSUE_ALERTS: "issue",
    NotificationSettingTypes.WORKFLOW: "workflow",
}


class NotificationSettingOptionValues(Enum):
    """
    An empty row in the DB should be represented as
    NotificationSettingOptionValues.DEFAULT.
    """

    # Defer to a setting one level up.
    DEFAULT = 0

    # Mute this kind of notification.
    NEVER = 10

    # Un-mute this kind of notification.
    ALWAYS = 20

    # Workflow only. Only send notifications about Issues that the target has
    # explicitly or implicitly opted-into.
    SUBSCRIBE_ONLY = 30

    # Deploy only. Only send notifications when the set of changes in the deploy
    # included a commit authored by the target.
    COMMITTED_ONLY = 40


NOTIFICATION_SETTING_OPTION_VALUES = {
    NotificationSettingOptionValues.DEFAULT: "default",
    NotificationSettingOptionValues.NEVER: "off",
    NotificationSettingOptionValues.ALWAYS: "on",
    NotificationSettingOptionValues.SUBSCRIBE_ONLY: "subscribe_only",
    NotificationSettingOptionValues.COMMITTED_ONLY: "committed_only",
}


class NotificationScopeType(Enum):
    USER = 0
    ORGANIZATION = 10
    PROJECT = 20


NOTIFICATION_SCOPE_TYPE = {
    NotificationScopeType.USER: "user",
    NotificationScopeType.ORGANIZATION: "organization",
    NotificationScopeType.PROJECT: "project",
}


class FineTuningAPIKey(Enum):
    ALERTS = "alerts"
    DEPLOY = "deploy"
    EMAIL = "email"
    REPORTS = "reports"
    WORKFLOW = "workflow"


class UserOptionsSettingsKey(Enum):
    DEPLOY = "deployNotifications"
    SELF_ACTIVITY = "personalActivityNotifications"
    SELF_ASSIGN = "selfAssignOnResolve"
    SUBSCRIBE_BY_DEFAULT = "subscribeByDefault"
    WORKFLOW = "workflowNotifications"
