from sentry.notifications.types import (
    FineTuningAPIKey,
    NotificationSettingTypes,
    NotificationSettingOptionValues,
    UserOptionsSettingsKey,
)


class UserOptionValue:
    # 'workflow:notifications'
    all_conversations = "0"
    participating_only = "1"
    no_conversations = "2"
    # 'deploy-emails
    all_deploys = "2"
    committed_deploys_only = "3"
    no_deploys = "4"


USER_OPTION_SETTINGS = {
    UserOptionsSettingsKey.DEPLOY: {
        "key": "deploy-emails",
        "default": UserOptionValue.committed_deploys_only,  # '3'
        "type": int,
    },
    UserOptionsSettingsKey.SELF_ACTIVITY: {
        "key": "self_notifications",
        "default": UserOptionValue.all_conversations,  # '0'
        "type": bool,
    },
    UserOptionsSettingsKey.SELF_ASSIGN: {
        "key": "self_assign_issue",
        "default": UserOptionValue.all_conversations,  # '0'
        "type": bool,
    },
    UserOptionsSettingsKey.SUBSCRIBE_BY_DEFAULT: {
        "key": "subscribe_by_default",
        "default": UserOptionValue.participating_only,  # '1'
        "type": bool,
    },
    UserOptionsSettingsKey.WORKFLOW: {
        "key": "workflow:notifications",
        "default": UserOptionValue.participating_only,  # '1'
        "type": int,
    },
}

FINE_TUNING_KEY_MAP = {
    FineTuningAPIKey.ALERTS: "mail:alert",
    FineTuningAPIKey.DEPLOY: "deploy-emails",
    FineTuningAPIKey.EMAIL: "mail:email",
    FineTuningAPIKey.REPORTS: "reports:disabled-organizations",
    FineTuningAPIKey.WORKFLOW: "workflow:notifications",
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

LEGACY_VALUE_TO_KEY = {
    NotificationSettingTypes.DEPLOY: {
        -1: NotificationSettingOptionValues.DEFAULT,
        2: NotificationSettingOptionValues.ALWAYS,
        3: NotificationSettingOptionValues.COMMITTED_ONLY,
        4: NotificationSettingOptionValues.NEVER,
    },
    NotificationSettingTypes.ISSUE_ALERTS: {
        -1: NotificationSettingOptionValues.DEFAULT,
        0: NotificationSettingOptionValues.NEVER,
        1: NotificationSettingOptionValues.ALWAYS,
    },
    NotificationSettingTypes.WORKFLOW: {
        -1: NotificationSettingOptionValues.DEFAULT,
        0: NotificationSettingOptionValues.ALWAYS,
        1: NotificationSettingOptionValues.SUBSCRIBE_ONLY,
        2: NotificationSettingOptionValues.NEVER,
    },
}


def get_legacy_key(type: NotificationSettingTypes) -> str:
    """
    Temporary mapping from new enum types to legacy strings.

    :param type: NotificationSettingTypes enum
    :return: String
    """

    return KEYS_TO_LEGACY_KEYS.get(type)


def get_legacy_value(type: NotificationSettingTypes, value: NotificationSettingOptionValues) -> str:
    """
    Temporary mapping from new enum types to legacy strings. Each type has a separate mapping.

    :param type: NotificationSettingTypes enum
    :param value: NotificationSettingOptionValues enum
    :return: String
    """

    return str(KEY_VALUE_TO_LEGACY_VALUE.get(type, {}).get(value))


def get_option_value_from_boolean(value: bool) -> NotificationSettingOptionValues:
    if value:
        return NotificationSettingOptionValues.ALWAYS
    else:
        return NotificationSettingOptionValues.NEVER


def get_option_value_from_int(
    type: NotificationSettingTypes, value: int
) -> NotificationSettingOptionValues:
    return LEGACY_VALUE_TO_KEY.get(type, {}).get(value)


def get_type_from_fine_tuning_key(key: FineTuningAPIKey) -> NotificationSettingTypes:
    return {
        FineTuningAPIKey.ALERTS: NotificationSettingTypes.ISSUE_ALERTS,
        FineTuningAPIKey.DEPLOY: NotificationSettingTypes.DEPLOY,
        FineTuningAPIKey.WORKFLOW: NotificationSettingTypes.WORKFLOW,
    }.get(key)


def get_legacy_key_from_fine_tuning_key(key: FineTuningAPIKey) -> str:
    return FINE_TUNING_KEY_MAP.get(key)


def get_type_from_user_option_settings_key(key: UserOptionsSettingsKey) -> NotificationSettingTypes:
    return {
        UserOptionsSettingsKey.DEPLOY: NotificationSettingTypes.DEPLOY,
        UserOptionsSettingsKey.WORKFLOW: NotificationSettingTypes.WORKFLOW,
        UserOptionsSettingsKey.SUBSCRIBE_BY_DEFAULT: NotificationSettingTypes.ISSUE_ALERTS,
    }.get(key)


def get_key_from_legacy(key: str) -> NotificationSettingTypes:
    return {
        "deploy-emails": NotificationSettingTypes.DEPLOY,
        "mail:alert": NotificationSettingTypes.ISSUE_ALERTS,
        "subscribe_by_default": NotificationSettingTypes.ISSUE_ALERTS,
        "workflow:notifications": NotificationSettingTypes.WORKFLOW,
    }.get(key)


def get_key_value_from_legacy(
    key: str, value: any
) -> (NotificationSettingTypes, NotificationSettingOptionValues):
    type = get_key_from_legacy(key)
    option_value = LEGACY_VALUE_TO_KEY.get(type, {}).get(int(value))

    return type, option_value
