from sentry.models.notificationsetting import (
    NotificationSettingTypes,
    NotificationSettingOptionValues,
)
from sentry.models.useroption import UserOptionValue

USER_OPTION_SETTINGS = {
    "deployNotifications": {
        "key": "deploy-emails",
        "default": UserOptionValue.committed_deploys_only,  # '3'
        "type": int,
    },
    "personalActivityNotifications": {
        "key": "self_notifications",
        "default": UserOptionValue.all_conversations,  # '0'
        "type": bool,
    },
    "selfAssignOnResolve": {
        "key": "self_assign_issue",
        "default": UserOptionValue.all_conversations,  # '0'
        "type": bool,
    },
    "subscribeByDefault": {
        "key": "subscribe_by_default",
        "default": UserOptionValue.participating_only,  # '1'
        "type": bool,
    },
    "workflowNotifications": {
        "key": "workflow:notifications",
        "default": UserOptionValue.participating_only,  # '1'
        "type": int,
    },
}

FINE_TUNING_KEY_MAP = {
    "alerts": {"key": "mail:alert", "type": int},
    "workflow": {"key": "workflow:notifications", "type": ""},
    "deploy": {"key": "deploy-emails", "type": ""},
    "reports": {"key": "reports:disabled-organizations", "type": ""},
    "email": {"key": "mail:email", "type": ""},
}

KEYS_TO_LEGACY_KEYS = {
    NotificationSettingTypes.DEPLOY: "deploy-emails",
    NotificationSettingTypes.ISSUE_ALERTS: "mail:alert",
    NotificationSettingTypes.WORKFLOW: "workflow:notifications",
}

KEY_VALUE_TO_LEGACY_VALUE = {
    NotificationSettingTypes.DEPLOY: {
        NotificationSettingOptionValues.ALWAYS: 2,
        NotificationSettingOptionValues.COMMITTED_ONLY: 3,
        NotificationSettingOptionValues.NEVER: 4,
    },
    NotificationSettingTypes.ISSUE_ALERTS: {
        NotificationSettingOptionValues.ALWAYS: 1,
        NotificationSettingOptionValues.NEVER: 0,
    },
    NotificationSettingTypes.WORKFLOW: {
        NotificationSettingOptionValues.ALWAYS: 0,
        NotificationSettingOptionValues.SUBSCRIBE_ONLY: 1,
        NotificationSettingOptionValues.NEVER: 2,
    },
}
