from collections import defaultdict
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Optional, Set, Tuple, Union

from sentry.notifications.types import (
    NOTIFICATION_SETTING_DEFAULTS,
    SUBSCRIPTION_REASON_MAP,
    VALID_VALUES_FOR_KEY,
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.types.integrations import ExternalProviders


def _get_setting_mapping_from_mapping(
    notification_settings_by_user: Mapping[
        Any,
        Mapping[NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    user: Any,
    type: NotificationSettingTypes,
) -> Mapping[ExternalProviders, NotificationSettingOptionValues]:
    # XXX(CEO): may not respect granularity of a setting for Slack a setting for email
    # but we'll worry about that later since we don't have a FE for it yet
    specific_scope = get_scope_type(type)
    notification_settings_mapping = notification_settings_by_user.get(user)
    if notification_settings_mapping:
        notification_setting_option = notification_settings_mapping.get(
            specific_scope
        ) or notification_settings_mapping.get(NotificationScopeType.USER)
        if notification_setting_option:
            return notification_setting_option

    return {ExternalProviders.EMAIL: NOTIFICATION_SETTING_DEFAULTS[type]}


def where_should_user_be_notified(
    notification_settings_by_user: Mapping[
        Any,
        Mapping[NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    user: Any,
) -> List[ExternalProviders]:
    """
    Given a mapping of default and specific notification settings by user,
    return the list of providers after verifying the user has opted into this notification.
    """
    mapping = _get_setting_mapping_from_mapping(
        notification_settings_by_user,
        user,
        NotificationSettingTypes.ISSUE_ALERTS,
    )
    return [
        provider
        for provider, value in mapping.items()
        if value == NotificationSettingOptionValues.ALWAYS
    ]


def should_be_participating(
    subscriptions_by_user_id: Mapping[int, Any],
    user: Any,
    value: NotificationSettingOptionValues,
) -> bool:
    subscription = subscriptions_by_user_id.get(user.id)
    return (
        subscription and subscription.is_active and value != NotificationSettingOptionValues.NEVER
    ) or (not subscription and value == NotificationSettingOptionValues.ALWAYS)


def where_should_be_participating(
    user: Any,
    subscriptions_by_user_id: Mapping[int, Any],
    notification_settings_by_user: Mapping[
        Any,
        Mapping[NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
) -> List[ExternalProviders]:
    """
    Given a mapping of users to subscriptions and a mapping of default and
    specific notification settings by user, determine where a user should receive
    a WORKFLOW notification. Unfortunately, this algorithm does not respect
    NotificationSettingOptionValues.ALWAYS. If the user is unsubscribed from
    the group, that overrides their notification preferences.
    """
    mapping = _get_setting_mapping_from_mapping(
        notification_settings_by_user,
        user,
        NotificationSettingTypes.WORKFLOW,
    )
    return [
        provider
        for provider, value in mapping.items()
        if should_be_participating(subscriptions_by_user_id, user, value)
    ]


def get_deploy_values_by_provider(
    notification_settings_by_scope: Mapping[
        NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]
    ],
    all_providers: Iterable[ExternalProviders],
) -> Mapping[ExternalProviders, NotificationSettingOptionValues]:
    """
    Given a mapping of scopes to a mapping of default and specific notification
    settings by provider, determine the notification setting by provider for
    DEPLOY notifications.
    """
    organization_specific_mapping = notification_settings_by_scope.get(
        NotificationScopeType.ORGANIZATION, {}
    )
    organization_independent_mapping = notification_settings_by_scope.get(
        NotificationScopeType.USER, {}
    )

    return {
        provider: (
            organization_specific_mapping.get(provider)
            or organization_independent_mapping.get(provider)
            or NotificationSettingOptionValues.COMMITTED_ONLY
        )
        for provider in all_providers
    }


def transform_to_notification_settings_by_user(
    notification_settings: Iterable[Any],
    users: Iterable[Any],
) -> Mapping[
    Any, Mapping[NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]]
]:
    """
    Given a unorganized list of notification settings, create a mapping of
    users to a map of notification scopes to setting values.
    """
    actor_mapping = {user.actor_id: user for user in users}
    notification_settings_by_user: Dict[
        Any, Dict[NotificationScopeType, Dict[ExternalProviders, NotificationSettingOptionValues]]
    ] = defaultdict(lambda: defaultdict(dict))
    for notification_setting in notification_settings:
        user = actor_mapping.get(notification_setting.target_id)
        scope_type = NotificationScopeType(notification_setting.scope_type)
        value = NotificationSettingOptionValues(notification_setting.value)
        provider = ExternalProviders(notification_setting.provider)
        notification_settings_by_user[user][scope_type][provider] = value
    return notification_settings_by_user


def transform_to_notification_settings_by_parent_id(
    notification_settings: Iterable[Any],
    user_default: Optional[NotificationSettingOptionValues] = None,
) -> Tuple[
    Mapping[ExternalProviders, Mapping[int, NotificationSettingOptionValues]],
    Mapping[ExternalProviders, Optional[NotificationSettingOptionValues]],
]:
    """
    Given a unorganized list of notification settings, create a mapping of
    providers to a mapping parents (projects or organizations) to setting
    values. Return this mapping as a tuple with a mapping of provider to the
    user's parent-independent notification preference.
    """
    notification_settings_by_parent_id: Dict[
        ExternalProviders, Dict[int, NotificationSettingOptionValues]
    ] = defaultdict(dict)

    # This is the user's default value for any projects or organizations that
    # don't have the option value specifically recorded.
    notification_setting_user_default: Dict[
        ExternalProviders, Optional[NotificationSettingOptionValues]
    ] = defaultdict(lambda: user_default)
    for notification_setting in notification_settings:
        scope_type = NotificationScopeType(notification_setting.scope_type)
        provider = ExternalProviders(notification_setting.provider)
        value = NotificationSettingOptionValues(notification_setting.value)

        if scope_type == NotificationScopeType.USER:
            notification_setting_user_default[provider] = value
        else:
            key = int(notification_setting.scope_identifier)
            notification_settings_by_parent_id[provider][key] = value
    return notification_settings_by_parent_id, notification_setting_user_default


def validate(type: NotificationSettingTypes, value: NotificationSettingOptionValues) -> bool:
    """ :returns boolean. True if the "value" is valid for the "type". """
    return value in VALID_VALUES_FOR_KEY.get(type, {})


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


def get_subscription_from_attributes(
    attrs: Mapping[str, Any]
) -> Tuple[bool, Optional[Mapping[str, Union[str, bool]]]]:
    subscription_details: Optional[Mapping[str, Union[str, bool]]] = None
    is_disabled, is_subscribed, subscription = attrs["subscription"]
    if is_disabled:
        subscription_details = {"disabled": True}
    elif subscription and subscription.is_active:
        subscription_details = {
            "reason": SUBSCRIPTION_REASON_MAP.get(subscription.reason, "unknown")
        }

    return is_subscribed, subscription_details


def get_groups_for_query(
    groups_by_project: Mapping[Any, Set[Any]],
    notification_settings_by_key: Mapping[int, NotificationSettingOptionValues],
    global_default_workflow_option: NotificationSettingOptionValues,
) -> Set[Any]:
    """
    If there is a subscription record associated with the group, we can just use
    that to know if a user is subscribed or not, as long as notifications aren't
    disabled for the project.
    """
    # Although this can be done with a comprehension, looping for clarity.
    output = set()
    for project, groups in groups_by_project.items():
        value = notification_settings_by_key.get(project.id, global_default_workflow_option)
        if value != NotificationSettingOptionValues.NEVER:
            output |= groups
    return output


def collect_groups_by_project(groups: Iterable[Any]) -> Mapping[Any, Set[Any]]:
    """
    Collect all of the projects to look up, and keep a set of groups that are
    part of that project. (Note that the common -- but not only -- case here is
    that all groups are part of the same project.)
    """
    projects = defaultdict(set)
    for group in groups:
        projects[group.project].add(group)
    return projects


def get_user_subscriptions_for_groups(
    groups_by_project: Mapping[Any, Set[Any]],
    notification_settings_by_key: Mapping[int, NotificationSettingOptionValues],
    subscriptions_by_group_id: Mapping[int, Any],
    global_default_workflow_option: NotificationSettingOptionValues,
) -> Mapping[int, Tuple[bool, bool, Optional[Any]]]:
    """
    Takes collected data and returns a mapping of group IDs to a two-tuple of
    (subscribed: bool, subscription: Optional[GroupSubscription]).
    """
    results = {}
    for project, groups in groups_by_project.items():
        project_default_workflow_option = notification_settings_by_key.get(
            project.id, global_default_workflow_option
        )
        for group in groups:
            subscription = subscriptions_by_group_id.get(group.id)

            is_disabled = False
            if subscription:
                is_active = subscription.is_active
            elif project_default_workflow_option == NotificationSettingOptionValues.NEVER:
                is_active = False
                is_disabled = True
            else:
                is_active = (
                    project_default_workflow_option == NotificationSettingOptionValues.ALWAYS
                )

            results[group.id] = (is_disabled, is_active, subscription)

    return results


def get_settings_by_provider(
    settings: Mapping[
        NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]
    ]
) -> MutableMapping[
    ExternalProviders, MutableMapping[NotificationScopeType, NotificationSettingOptionValues]
]:
    output: MutableMapping[
        ExternalProviders, MutableMapping[NotificationScopeType, NotificationSettingOptionValues]
    ] = defaultdict(dict)

    for scope_type in settings:
        for provider, value in settings[scope_type].items():
            output[provider][scope_type] = value

    return output
