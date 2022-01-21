from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.types.integrations import ExternalProviders

"""
These mappings represents how to interpret the absence of a DB row for a given
provider. For example, a user with no NotificationSettings should be opted
into receiving emails but no Slack messages.
"""

# Each type has a different "sometimes" value.
NOTIFICATION_SETTINGS_ALL_SOMETIMES = {
    NotificationSettingTypes.DEPLOY: NotificationSettingOptionValues.COMMITTED_ONLY,
    NotificationSettingTypes.ISSUE_ALERTS: NotificationSettingOptionValues.ALWAYS,
    NotificationSettingTypes.WORKFLOW: NotificationSettingOptionValues.SUBSCRIBE_ONLY,
    NotificationSettingTypes.APPROVAL: NotificationSettingOptionValues.ALWAYS,
    NotificationSettingTypes.QUOTA: NotificationSettingOptionValues.ALWAYS,
    NotificationSettingTypes.QUOTA_ERRORS: NotificationSettingOptionValues.ALWAYS,
    NotificationSettingTypes.QUOTA_TRANSACTIONS: NotificationSettingOptionValues.ALWAYS,
    NotificationSettingTypes.QUOTA_ATTACHMENTS: NotificationSettingOptionValues.ALWAYS,
    NotificationSettingTypes.QUOTA_WARNINGS: NotificationSettingOptionValues.ALWAYS,
}

NOTIFICATION_SETTINGS_SLACK = {
    NotificationSettingTypes.DEPLOY: NotificationSettingOptionValues.NEVER,
    NotificationSettingTypes.ISSUE_ALERTS: NotificationSettingOptionValues.NEVER,
    NotificationSettingTypes.WORKFLOW: NotificationSettingOptionValues.NEVER,
    NotificationSettingTypes.APPROVAL: NotificationSettingOptionValues.ALWAYS,
    NotificationSettingTypes.QUOTA: NotificationSettingOptionValues.ALWAYS,
    NotificationSettingTypes.QUOTA_ERRORS: NotificationSettingOptionValues.ALWAYS,
    NotificationSettingTypes.QUOTA_TRANSACTIONS: NotificationSettingOptionValues.ALWAYS,
    NotificationSettingTypes.QUOTA_ATTACHMENTS: NotificationSettingOptionValues.ALWAYS,
    NotificationSettingTypes.QUOTA_WARNINGS: NotificationSettingOptionValues.ALWAYS,
}

NOTIFICATION_SETTING_DEFAULTS = {
    ExternalProviders.EMAIL: NOTIFICATION_SETTINGS_ALL_SOMETIMES,
    ExternalProviders.SLACK: NOTIFICATION_SETTINGS_SLACK,
}
