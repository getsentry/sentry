from sentry.notifications.types import NotificationSettingEnum, NotificationSettingsOptionEnum
from sentry.types.integrations import ExternalProviders

"""
These mappings represents how to interpret the absence of a DB row for a given
provider. For example, a user with no NotificationSettings should be opted
into receiving emails but no Slack messages.
"""

# Each type has a different "sometimes" value.
NOTIFICATION_SETTINGS_ALL_SOMETIMES = {
    NotificationSettingEnum.DEPLOY: NotificationSettingsOptionEnum.COMMITTED_ONLY,
    NotificationSettingEnum.ISSUE_ALERTS: NotificationSettingsOptionEnum.ALWAYS,
    NotificationSettingEnum.WORKFLOW: NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
    NotificationSettingEnum.APPROVAL: NotificationSettingsOptionEnum.ALWAYS,
    NotificationSettingEnum.QUOTA: NotificationSettingsOptionEnum.ALWAYS,
    NotificationSettingEnum.QUOTA_ERRORS: NotificationSettingsOptionEnum.ALWAYS,
    NotificationSettingEnum.QUOTA_TRANSACTIONS: NotificationSettingsOptionEnum.ALWAYS,
    NotificationSettingEnum.QUOTA_ATTACHMENTS: NotificationSettingsOptionEnum.ALWAYS,
    NotificationSettingEnum.QUOTA_REPLAYS: NotificationSettingsOptionEnum.ALWAYS,
    NotificationSettingEnum.QUOTA_WARNINGS: NotificationSettingsOptionEnum.ALWAYS,
    NotificationSettingEnum.QUOTA_SPEND_ALLOCATIONS: NotificationSettingsOptionEnum.ALWAYS,
    NotificationSettingEnum.SPIKE_PROTECTION: NotificationSettingsOptionEnum.ALWAYS,
    NotificationSettingEnum.REPORTS: NotificationSettingsOptionEnum.ALWAYS,
}


NOTIFICATION_SETTINGS_DEFAULT_OFF = {
    NotificationSettingEnum.DEPLOY: NotificationSettingsOptionEnum.NEVER,
    NotificationSettingEnum.ISSUE_ALERTS: NotificationSettingsOptionEnum.NEVER,
    NotificationSettingEnum.WORKFLOW: NotificationSettingsOptionEnum.NEVER,
    NotificationSettingEnum.APPROVAL: NotificationSettingsOptionEnum.NEVER,
    NotificationSettingEnum.QUOTA: NotificationSettingsOptionEnum.NEVER,
    NotificationSettingEnum.QUOTA_ERRORS: NotificationSettingsOptionEnum.NEVER,
    NotificationSettingEnum.QUOTA_TRANSACTIONS: NotificationSettingsOptionEnum.NEVER,
    NotificationSettingEnum.QUOTA_ATTACHMENTS: NotificationSettingsOptionEnum.NEVER,
    NotificationSettingEnum.QUOTA_REPLAYS: NotificationSettingsOptionEnum.NEVER,
    NotificationSettingEnum.QUOTA_WARNINGS: NotificationSettingsOptionEnum.NEVER,
    NotificationSettingEnum.QUOTA_SPEND_ALLOCATIONS: NotificationSettingsOptionEnum.NEVER,
    NotificationSettingEnum.SPIKE_PROTECTION: NotificationSettingsOptionEnum.NEVER,
    NotificationSettingEnum.REPORTS: NotificationSettingsOptionEnum.NEVER,
}


# email and slack are defaulted to being on
NOTIFICATION_SETTING_DEFAULTS = {
    ExternalProviders.EMAIL: NOTIFICATION_SETTINGS_ALL_SOMETIMES,
    ExternalProviders.SLACK: NOTIFICATION_SETTINGS_ALL_SOMETIMES,
    ExternalProviders.MSTEAMS: NOTIFICATION_SETTINGS_DEFAULT_OFF,
}
