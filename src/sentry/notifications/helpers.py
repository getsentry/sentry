from collections import defaultdict
from typing import (
    TYPE_CHECKING,
    Any,
    Dict,
    Iterable,
    List,
    Mapping,
    MutableMapping,
    Optional,
    Set,
    Tuple,
    Union,
)

from sentry.features.helpers import any_organization_has_feature
from sentry.notifications.defaults import (
    NOTIFICATION_SETTING_DEFAULTS,
    NOTIFICATION_SETTINGS_ALL_SOMETIMES,
)
from sentry.notifications.types import (
    NOTIFICATION_SCOPE_TYPE,
    NOTIFICATION_SETTING_OPTION_VALUES,
    NOTIFICATION_SETTING_TYPES,
    SUBSCRIPTION_REASON_MAP,
    VALID_VALUES_FOR_KEY,
    GroupSubscriptionReason,
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders

if TYPE_CHECKING:
    from sentry.models import (
        Group,
        GroupSubscription,
        NotificationSetting,
        Organization,
        Project,
        Team,
        User,
    )


def _get_notification_setting_default(
    provider: ExternalProviders,
    type: NotificationSettingTypes,
    organization: Optional["Organization"] = None,
    user: Optional["User"] = None,
) -> NotificationSettingOptionValues:
    """
    In order to increase engagement, we automatically opt users into receiving
    Slack notifications if they install Slack and link their identity.
    """
    actor, organizations = None, []
    if organization:
        organizations = [organization]
    elif user:
        if user.is_anonymous:
            organizations = []
        else:
            organizations = user.get_orgs()
        actor = user

    if any_organization_has_feature(
        "organizations:notification-slack-automatic", organizations, actor=actor
    ):
        return NOTIFICATION_SETTINGS_ALL_SOMETIMES[type]
    return NOTIFICATION_SETTING_DEFAULTS[provider][type]


def _get_setting_mapping_from_mapping(
    notification_settings_by_user: Mapping[
        "User",
        Mapping[NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    user: "User",
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

    return {
        provider: _get_notification_setting_default(provider, type, user=user)
        for provider in [ExternalProviders.EMAIL]
    }


def where_should_user_be_notified(
    notification_settings_by_user: Mapping[
        "User",
        Mapping[NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    user: "User",
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
    subscription: Optional[Any],
    value: NotificationSettingOptionValues,
) -> bool:
    """
    Give a user's subscription (on, off, or null) to a group and their
    notification setting value(on, off, or sometimes), decide whether or not to
    send the user a notification.
    """
    return (
        subscription and subscription.is_active and value != NotificationSettingOptionValues.NEVER
    ) or (not subscription and value == NotificationSettingOptionValues.ALWAYS)


def where_should_be_participating(
    user: "User",
    subscription: Optional["GroupSubscription"],
    notification_settings_by_user: Mapping[
        "User",
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
        if should_be_participating(subscription, value)
    ]


def get_values_by_provider_by_type(
    notification_settings_by_scope: Mapping[
        NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]
    ],
    all_providers: Iterable[ExternalProviders],
    type: NotificationSettingTypes,
    organization: "Organization",
) -> Mapping[ExternalProviders, NotificationSettingOptionValues]:
    """
    Given a mapping of scopes to a mapping of default and specific notification
    settings by provider, determine the notification setting by provider for
    the given notification type.
    TODO(mgaeta): Remove `organization` parameter.
    """
    parent_scope = get_scope_type(type)

    parent_specific_mapping = notification_settings_by_scope.get(parent_scope, {})
    organization_independent_mapping = notification_settings_by_scope.get(
        NotificationScopeType.USER, {}
    )

    return {
        provider: (
            parent_specific_mapping.get(provider)
            or organization_independent_mapping.get(provider)
            or _get_notification_setting_default(provider, type, organization=organization)
        )
        for provider in all_providers
    }


def transform_to_notification_settings_by_user(
    notification_settings: Iterable["NotificationSetting"],
    users: Iterable["User"],
) -> Mapping[
    "User",
    Mapping[NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]],
]:
    """
    Given an unsorted list of notification settings, create a mapping of users
    to a map of notification scopes to setting values.
    """
    actor_mapping = {user.actor_id: user for user in users}
    notification_settings_by_user: Dict[
        "User",
        Dict[NotificationScopeType, Dict[ExternalProviders, NotificationSettingOptionValues]],
    ] = defaultdict(lambda: defaultdict(dict))
    for notification_setting in notification_settings:
        user = actor_mapping.get(notification_setting.target_id)
        scope_type = NotificationScopeType(notification_setting.scope_type)
        value = NotificationSettingOptionValues(notification_setting.value)
        provider = ExternalProviders(notification_setting.provider)
        notification_settings_by_user[user][scope_type][provider] = value
    return notification_settings_by_user


def transform_to_notification_settings_by_scope(
    notification_settings: Iterable["NotificationSetting"],
) -> Mapping[
    NotificationScopeType,
    Mapping[int, Mapping[ExternalProviders, NotificationSettingOptionValues]],
]:
    """
    Given an unsorted list of notification settings, create a mapping of scopes
    (user or parent) and their IDs to a map of provider to notifications setting values.
    """
    notification_settings_by_scopes: Dict[
        NotificationScopeType, Dict[int, Dict[ExternalProviders, NotificationSettingOptionValues]]
    ] = defaultdict(lambda: defaultdict(lambda: dict()))

    for notification_setting in notification_settings:
        scope_type = NotificationScopeType(notification_setting.scope_type)
        scope_id = notification_setting.scope_identifier
        provider = ExternalProviders(notification_setting.provider)
        value = NotificationSettingOptionValues(notification_setting.value)

        notification_settings_by_scopes[scope_type][scope_id][provider] = value

    return notification_settings_by_scopes


def validate(type: NotificationSettingTypes, value: NotificationSettingOptionValues) -> bool:
    """:returns boolean. True if the "value" is valid for the "type"."""
    return value in VALID_VALUES_FOR_KEY.get(type, {})


def get_scope_type(type: NotificationSettingTypes) -> NotificationScopeType:
    """In which scope (proj or org) can a user set more specific settings?"""
    if type in [NotificationSettingTypes.DEPLOY]:
        return NotificationScopeType.ORGANIZATION

    if type in [NotificationSettingTypes.WORKFLOW, NotificationSettingTypes.ISSUE_ALERTS]:
        return NotificationScopeType.PROJECT

    raise Exception(f"type {type}, must be alerts, deploy, or workflow")


def get_scope(
    user: Optional["User"] = None,
    team: Optional["Team"] = None,
    project: Optional["Project"] = None,
    organization: Optional["Organization"] = None,
) -> Tuple[NotificationScopeType, int]:
    """
    Figure out the scope from parameters and return it as a tuple.
    TODO(mgaeta): Make sure the user/team is in the project/organization.
    """

    if project:
        return NotificationScopeType.PROJECT, project.id

    if organization:
        return NotificationScopeType.ORGANIZATION, organization.id

    if team:
        return NotificationScopeType.TEAM, team.id

    if user:
        return NotificationScopeType.USER, user.id

    raise Exception("scope must be either user, team, organization, or project")


def get_target_id(user: Optional["User"] = None, team: Optional["Team"] = None) -> int:
    """:returns the actor ID from a User or Team."""
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
    groups_by_project: Mapping["Project", Set["Group"]],
    notification_settings_by_scope: Mapping[
        NotificationScopeType,
        Mapping[int, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    user: "User",
) -> Set["Group"]:
    """
    If there is a subscription record associated with the group, we can just use
    that to know if a user is subscribed or not, as long as notifications aren't
    disabled for the project.
    """
    # Although this can be done with a comprehension, looping for clarity.
    output = set()
    for project, groups in groups_by_project.items():
        value = get_most_specific_notification_setting_value(
            notification_settings_by_scope,
            user=user,
            parent_id=project.id,
            type=NotificationSettingTypes.WORKFLOW,
        )
        if value != NotificationSettingOptionValues.NEVER:
            output |= groups
    return output


def collect_groups_by_project(groups: Iterable["Group"]) -> Mapping["Project", Set["Group"]]:
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
    groups_by_project: Mapping["Project", Set["Group"]],
    notification_settings_by_scope: Mapping[
        NotificationScopeType,
        Mapping[int, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    subscriptions_by_group_id: Mapping[int, "GroupSubscription"],
    user: "User",
) -> Mapping[int, Tuple[bool, bool, Optional["GroupSubscription"]]]:
    """Takes collected data and returns a mapping of group IDs to a three-tuple of values."""
    results = {}
    for project, groups in groups_by_project.items():
        value = get_most_specific_notification_setting_value(
            notification_settings_by_scope,
            user=user,
            parent_id=project.id,
            type=NotificationSettingTypes.WORKFLOW,
        )
        for group in groups:
            subscription = subscriptions_by_group_id.get(group.id)

            is_disabled = False
            if subscription:
                is_active = subscription.is_active
            elif value == NotificationSettingOptionValues.NEVER:
                is_active = False
                is_disabled = True
            else:
                is_active = value == NotificationSettingOptionValues.ALWAYS

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


def get_fallback_settings(
    types_to_serialize: Iterable[NotificationSettingTypes],
    project_ids: Iterable[int],
    organization_ids: Iterable[int],
    user: Optional["User"] = None,
) -> MutableMapping[str, MutableMapping[str, MutableMapping[int, MutableMapping[str, str]]]]:
    """
    The API is responsible for calculating the implied setting values when a
    user or team does not have explicit notification settings. This function
    creates a "dummy" version of the nested object of notification settings that
    can be overridden by explicit settings.
    """
    data: MutableMapping[
        str, MutableMapping[str, MutableMapping[int, MutableMapping[str, str]]]
    ] = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))

    parent_independent_value_str = NOTIFICATION_SETTING_OPTION_VALUES[
        NotificationSettingOptionValues.DEFAULT
    ]

    # Set the application-wide defaults in case they aren't set.
    for type_enum in types_to_serialize:
        scope_type = get_scope_type(type_enum)
        scope_str = NOTIFICATION_SCOPE_TYPE[scope_type]
        type_str = NOTIFICATION_SETTING_TYPES[type_enum]

        for provider in NOTIFICATION_SETTING_DEFAULTS.keys():
            provider_str = EXTERNAL_PROVIDERS[provider]

            parent_ids = (
                project_ids if scope_type == NotificationScopeType.PROJECT else organization_ids
            )
            for parent_id in parent_ids:
                data[type_str][scope_str][parent_id][provider_str] = parent_independent_value_str

            # Only users (i.e. not teams) have parent-independent notification settings.
            if user:
                # Each provider has it's own defaults by type.
                value = _get_notification_setting_default(provider, type_enum, user=user)
                value_str = NOTIFICATION_SETTING_OPTION_VALUES[value]
                user_scope_str = NOTIFICATION_SCOPE_TYPE[NotificationScopeType.USER]

                data[type_str][user_scope_str][user.id][provider_str] = value_str
    return data


def get_reason_context(extra_context: Mapping[str, Any]) -> MutableMapping[str, str]:
    """Get user-specific context. Do not call get_context() here."""
    reason = extra_context.get("reason", 0)
    return {
        "reason": GroupSubscriptionReason.descriptions.get(reason, "are subscribed to this issue")
    }


def get_highest_notification_setting_value(
    notification_settings_by_provider: Mapping[ExternalProviders, NotificationSettingOptionValues],
) -> Optional[NotificationSettingOptionValues]:
    """
    Find the "most specific" notification setting value. Currently non-NEVER
    values are locked together (for example, you cannot have
    `{"email": "always", "slack": "subscribe_only"}` but you can have
    `{"email": "always", "slack": "never"}` and
    `{"email": "always", "slack": "always"}`), but this might change. This is a
    HACK but if we put an explicit ordering here It'd match the implicit ordering.
    """
    if not notification_settings_by_provider:
        return None
    return max(notification_settings_by_provider.values(), key=lambda v: v.value)


def get_most_specific_notification_setting_value(
    notification_settings_by_scope: Mapping[
        NotificationScopeType,
        Mapping[int, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    user: "User",
    parent_id: int,
    type: NotificationSettingTypes,
) -> NotificationSettingOptionValues:
    """
    Get the "most specific" notification setting value for a given user and
    project. If there are no settings, default to the default setting for EMAIL.
    """
    return (
        get_highest_notification_setting_value(
            notification_settings_by_scope.get(get_scope_type(type), {}).get(parent_id, {})
        )
        or get_highest_notification_setting_value(
            notification_settings_by_scope.get(NotificationScopeType.USER, {}).get(user.id, {})
        )
        or _get_notification_setting_default(ExternalProviders.EMAIL, type, user=user)
    )
