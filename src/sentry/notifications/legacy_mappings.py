from collections import namedtuple
from typing import Any, Iterable, List, Mapping, Optional, Tuple

from sentry.notifications.types import (
    FineTuningAPIKey,
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
    UserOptionsSettingsKey,
)

LegacyUserOptionClone = namedtuple(
    "LegacyUserOptionClone",
    [
        "user",
        "project",
        "organization",
        "key",
        "value",
    ],
)

USER_OPTION_SETTINGS = {
    UserOptionsSettingsKey.DEPLOY: {
        "key": "deploy-emails",
        "default": "3",
        "type": int,
    },
    UserOptionsSettingsKey.SELF_ACTIVITY: {
        "key": "self_notifications",
        "default": "0",
        "type": bool,
    },
    UserOptionsSettingsKey.SELF_ASSIGN: {
        "key": "self_assign_issue",
        "default": "0",
        "type": bool,
    },
    UserOptionsSettingsKey.SUBSCRIBE_BY_DEFAULT: {
        "key": "subscribe_by_default",
        "default": "1",
        "type": bool,
    },
    UserOptionsSettingsKey.WORKFLOW: {
        "key": "workflow:notifications",
        "default": "1",
        "type": int,
    },
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


def get_legacy_key(
    type: NotificationSettingTypes, scope_type: NotificationScopeType
) -> Optional[str]:
    """ Temporary mapping from new enum types to legacy strings. """
    if scope_type == NotificationScopeType.USER and type == NotificationSettingTypes.ISSUE_ALERTS:
        return "subscribe_by_default"

    return KEYS_TO_LEGACY_KEYS.get(type)


def get_legacy_value(type: NotificationSettingTypes, value: NotificationSettingOptionValues) -> str:
    """
    Temporary mapping from new enum types to legacy strings. Each type has a separate mapping.
    """

    return str(KEY_VALUE_TO_LEGACY_VALUE.get(type, {}).get(value))


def get_option_value_from_boolean(value: bool) -> NotificationSettingOptionValues:
    if value:
        return NotificationSettingOptionValues.ALWAYS
    else:
        return NotificationSettingOptionValues.NEVER


def get_option_value_from_int(
    type: NotificationSettingTypes, value: int
) -> Optional[NotificationSettingOptionValues]:
    return LEGACY_VALUE_TO_KEY.get(type, {}).get(value)


def get_type_from_fine_tuning_key(key: FineTuningAPIKey) -> Optional[NotificationSettingTypes]:
    return {
        FineTuningAPIKey.ALERTS: NotificationSettingTypes.ISSUE_ALERTS,
        FineTuningAPIKey.DEPLOY: NotificationSettingTypes.DEPLOY,
        FineTuningAPIKey.WORKFLOW: NotificationSettingTypes.WORKFLOW,
    }.get(key)


def get_type_from_user_option_settings_key(
    key: UserOptionsSettingsKey,
) -> Optional[NotificationSettingTypes]:
    return {
        UserOptionsSettingsKey.DEPLOY: NotificationSettingTypes.DEPLOY,
        UserOptionsSettingsKey.WORKFLOW: NotificationSettingTypes.WORKFLOW,
        UserOptionsSettingsKey.SUBSCRIBE_BY_DEFAULT: NotificationSettingTypes.ISSUE_ALERTS,
    }.get(key)


def get_key_from_legacy(key: str) -> Optional[NotificationSettingTypes]:
    return {
        "deploy-emails": NotificationSettingTypes.DEPLOY,
        "mail:alert": NotificationSettingTypes.ISSUE_ALERTS,
        "subscribe_by_default": NotificationSettingTypes.ISSUE_ALERTS,
        "workflow:notifications": NotificationSettingTypes.WORKFLOW,
    }.get(key)


def get_key_value_from_legacy(
    key: str, value: Any
) -> Tuple[Optional[NotificationSettingTypes], Optional[NotificationSettingOptionValues]]:
    type = get_key_from_legacy(key)
    if type not in LEGACY_VALUE_TO_KEY:
        return None, None
    option_value = LEGACY_VALUE_TO_KEY.get(type, {}).get(int(value))

    return type, option_value


def get_legacy_object(
    notification_setting: Any,
    actor_mapping: Mapping[int, Any],
    parent_mapping: Mapping[int, Any],
    organization_mapping: Mapping[int, Any],
) -> Any:
    type = NotificationSettingTypes(notification_setting.type)
    value = NotificationSettingOptionValues(notification_setting.value)
    scope_type = NotificationScopeType(notification_setting.scope_type)
    key = get_legacy_key(type, scope_type)

    data = {
        "key": key,
        "value": get_legacy_value(type, value),
        "user": actor_mapping.get(notification_setting.target_id),
        "project": None,
        "organization": None,
    }

    if scope_type == NotificationScopeType.PROJECT:
        data["project"] = parent_mapping.get(notification_setting.scope_identifier)
    if scope_type == NotificationScopeType.ORGANIZATION:
        data["organization"] = organization_mapping.get(notification_setting.scope_identifier)

    return LegacyUserOptionClone(**data)


def map_notification_settings_to_legacy(
    notification_settings: Iterable[Any],
    actor_mapping: Mapping[int, Any],
) -> List[Any]:
    """ A hack for legacy serializers. Pretend a list of NotificationSettings is a list of UserOptions. """
    project_mapping, organization_mapping = get_parent_mappings(notification_settings)
    return [
        get_legacy_object(
            notification_setting, actor_mapping, project_mapping, organization_mapping
        )
        for notification_setting in notification_settings
    ]


def get_parent_mappings(
    notification_settings: Iterable[Any],
) -> Tuple[Mapping[int, Any], Mapping[int, Any]]:
    """ Prefetch a list of Project or Organization objects for the Serializer. """
    from sentry.models.organization import Organization
    from sentry.models.project import Project

    project_ids = []
    organization_ids = []
    for notification_setting in notification_settings:
        if notification_setting.scope_type == NotificationScopeType.PROJECT.value:
            project_ids.append(notification_setting.scope_identifier)
        if notification_setting.scope_type == NotificationScopeType.ORGANIZATION.value:
            organization_ids.append(notification_setting.scope_identifier)

    projects = Project.objects.filter(id__in=project_ids)
    organizations = Organization.objects.filter(id__in=organization_ids)

    project_mapping = {project.id: project for project in projects}
    organization_mapping = {organization.id: organization for organization in organizations}

    return project_mapping, organization_mapping
