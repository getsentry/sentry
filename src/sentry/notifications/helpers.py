from collections import defaultdict
from typing import Any, Dict, Iterable, Mapping, Optional, Tuple

from sentry.notifications.legacy_mappings import get_legacy_value
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)


def _get_setting_value_from_mapping(
    notification_settings_by_user: Mapping[
        Any, Mapping[NotificationScopeType, NotificationSettingOptionValues]
    ],
    user: Any,
    type: NotificationSettingTypes,
    default: NotificationSettingOptionValues,
) -> NotificationSettingOptionValues:
    specific_scope = get_scope_type(type)
    notification_settings_option = notification_settings_by_user.get(user)
    if notification_settings_option:
        notification_setting_option = notification_settings_option.get(
            specific_scope
        ) or notification_settings_option.get(NotificationScopeType.USER)
        if notification_setting_option:
            return notification_setting_option
    return default


def should_user_be_notified(
    notification_settings_by_user: Mapping[
        Any, Mapping[NotificationScopeType, NotificationSettingOptionValues]
    ],
    user: Any,
) -> bool:
    """
    Given a mapping of default and specific notification settings by user,
    determine if a user should receive an ISSUE_ALERT notification.
    """
    return (
        _get_setting_value_from_mapping(
            notification_settings_by_user,
            user,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
        )
        == NotificationSettingOptionValues.ALWAYS
    )


def should_be_participating(
    user: Any,
    subscriptions_by_user_id: Mapping[int, Any],
    notification_settings_by_user: Mapping[
        Any, Mapping[NotificationScopeType, NotificationSettingOptionValues]
    ],
) -> bool:
    """
    Given a mapping of users to subscriptions and a mapping of default and
    specific notification settings by user, determine if a user should receive
    a WORKFLOW notification.
    """
    value = _get_setting_value_from_mapping(
        notification_settings_by_user,
        user,
        NotificationSettingTypes.WORKFLOW,
        NotificationSettingOptionValues.SUBSCRIBE_ONLY,
    )

    if value == NotificationSettingOptionValues.NEVER:
        return False

    if value == NotificationSettingOptionValues.ALWAYS:
        return True

    subscription = subscriptions_by_user_id.get(user.id)
    return bool(subscription and subscription.is_active)


def transform_to_notification_settings_by_user(
    notification_settings: Iterable[Any],
    users: Iterable[Any],
) -> Mapping[Any, Mapping[NotificationScopeType, NotificationSettingOptionValues]]:
    """
    Given a unorganized list of notification settings, create a mapping of
    users to a map of notification scopes to setting values.
    """
    actor_mapping = {user.actor_id: user for user in users}
    notification_settings_by_user: Dict[
        Any, Dict[NotificationScopeType, NotificationSettingOptionValues]
    ] = defaultdict(dict)
    for notification_setting in notification_settings:
        user = actor_mapping.get(notification_setting.target_id)
        notification_settings_by_user[user][
            NotificationScopeType(notification_setting.scope_type)
        ] = NotificationSettingOptionValues(notification_setting.value)
    return notification_settings_by_user


def transform_to_notification_settings_by_parent_id(
    notification_settings: Iterable[Any],
) -> Tuple[
    Mapping[int, NotificationSettingOptionValues], Optional[NotificationSettingOptionValues]
]:
    """
    Given a unorganized list of notification settings, create a mapping of
    parents (projects or organizations) to setting values. Return this mapping
    as a tuple with the user's parent-independent notification preference.
    """
    notification_settings_by_parent_id = {}
    notification_setting_user_default = None
    for notification_setting in notification_settings:
        if notification_setting.scope_type == NotificationScopeType.USER.value:
            notification_setting_user_default = NotificationSettingOptionValues(
                notification_setting.value
            )
        else:
            key = int(notification_setting.scope_identifier)
            notification_settings_by_parent_id[key] = NotificationSettingOptionValues(
                notification_setting.value
            )
    return notification_settings_by_parent_id, notification_setting_user_default


def validate(type: NotificationSettingTypes, value: NotificationSettingOptionValues) -> bool:
    """ :returns boolean. True if the "value" is valid for the "type". """
    return get_legacy_value(type, value) is not None


def get_scope_type(type: NotificationSettingTypes) -> NotificationScopeType:
    """ In which scope (proj or org) can a user set more specific settings?"""
    if type in [NotificationSettingTypes.DEPLOY]:
        return NotificationScopeType.ORGANIZATION

    if type in [NotificationSettingTypes.WORKFLOW, NotificationSettingTypes.ISSUE_ALERTS]:
        return NotificationScopeType.PROJECT

    raise Exception("type must be issue_alert, deploy, or workflow")


def get_scope(
    user_id: int, project: Optional[Any] = None, organization: Optional[Any] = None
) -> Tuple[NotificationScopeType, int]:
    """
    Figure out the scope from parameters and return it as a tuple.
    TODO(mgaeta): Make sure user_id is in the project or organization.
    """

    if project:
        return NotificationScopeType.PROJECT, project.id

    if organization:
        return NotificationScopeType.ORGANIZATION, organization.id

    if user_id:
        return NotificationScopeType.USER, user_id

    raise Exception("scope must be either user, organization, or project")


def get_target_id(user: Optional[Any] = None, team: Optional[Any] = None) -> int:
    """ :returns the actor ID from a User or Team. """
    if user:
        return int(user.actor_id)
    if team:
        return int(team.actor_id)

    raise Exception("target must be either a user or a team")
