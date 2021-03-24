from collections import defaultdict
from typing import List, Mapping, Optional

from sentry.notifications.legacy_mappings import get_legacy_value
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)


def should_user_be_notified(
    notification_settings_by_user: Mapping[
        any, Mapping[NotificationScopeType, NotificationSettingOptionValues]
    ],
    user,
) -> bool:
    """
    Given a mapping of default and specific notification settings by user,
    determine if a user should receive an ISSUE_ALERT notification.
    """
    specific_scope = get_scope_type(NotificationSettingTypes.ISSUE_ALERTS)
    notification_setting_option = (
        notification_settings_by_user.get(user)[specific_scope]
        or notification_settings_by_user.get(user)[NotificationScopeType.USER]
    )
    value = getattr(
        notification_setting_option,
        "value",
        NotificationSettingOptionValues.ALWAYS,
    )

    return value == NotificationSettingOptionValues.ALWAYS.value


def should_be_participating(
    user,
    subscriptions_by_user_id: Mapping[int, any],
    notification_settings_by_user: Mapping[
        any, Mapping[NotificationScopeType, NotificationSettingOptionValues]
    ],
) -> bool:
    """
    Given a mapping of users to subscriptions and a mapping of default and
    specific notification settings by user, determine if a user should receive
    a WORKFLOW notification.
    """
    specific_scope = get_scope_type(NotificationSettingTypes.WORKFLOW)
    notification_setting_option = (
        notification_settings_by_user.get(user)[specific_scope]
        or notification_settings_by_user.get(user)[NotificationScopeType.USER]
    )
    value = getattr(
        notification_setting_option,
        "value",
        NotificationSettingOptionValues.SUBSCRIBE_ONLY,
    )
    if value == NotificationSettingOptionValues.NEVER.value:
        return False

    if value == NotificationSettingOptionValues.ALWAYS.value:
        return True

    subscription = subscriptions_by_user_id.get(user.id)
    return subscription and subscription.is_active


def transform_to_notification_settings_by_user(
    notification_settings: List,
    users: List,
) -> Mapping[any, Mapping[NotificationScopeType, NotificationSettingOptionValues]]:
    """
    Given a unorganized list of notification settings, create a mapping of
    users to a map of notification scopes to setting values.
    """
    actor_mapping = {user.actor: user for user in users}
    notification_settings_by_user = defaultdict(dict)
    for notification_setting in notification_settings:
        user = actor_mapping.get(notification_setting.target)
        notification_settings_by_user.get(user)[
            notification_setting.scope_type
        ] = notification_setting.value
    return notification_settings_by_user


def transform_to_notification_settings_by_parent_id(
    notification_settings: List,
) -> (Mapping[int, NotificationSettingOptionValues], Optional[NotificationSettingOptionValues]):
    """
    Given a unorganized list of notification settings, create a mapping of
    parents (projects or organizations) to setting values. Return this mapping
    as a tuple with the user's parent-independent notification preference.
    """
    notification_settings_by_parent_id = defaultdict(dict)
    notification_setting_user_default = None
    for notification_setting in notification_settings:
        if notification_setting.scope_type == NotificationScopeType.USER:
            notification_setting_user_default = notification_setting.value
        else:
            key = notification_setting.scope_identifier
            notification_settings_by_parent_id[key] = notification_setting.value
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
    user_id: int, project: Optional = None, organization: Optional = None
) -> (NotificationScopeType, int):
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


def get_target(user: Optional = None, team: Optional = None):
    """ :returns the Actor object from a User or Team. """
    try:
        return getattr((user or team), "actor")
    except AttributeError:
        raise Exception("target must be either a user or a team")
