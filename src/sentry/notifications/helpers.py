from __future__ import annotations

from collections import defaultdict
from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping

from sentry.notifications.defaults import NOTIFICATION_SETTING_DEFAULTS
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
from sentry.types.integrations import (
    EXTERNAL_PROVIDERS,
    ExternalProviders,
    get_provider_enum,
    get_provider_enum_from_string,
    get_provider_name,
)

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
    recipient: Team | User | None = None,  # not needed right now
) -> NotificationSettingOptionValues:
    """
    In order to increase engagement, we automatically opt users into receiving
    Slack notifications if they install Slack and link their identity.
    Approval notifications always default to Slack being on.
    """
    from sentry.models import Team

    # every team default is off
    if isinstance(recipient, Team):
        return NotificationSettingOptionValues.NEVER
    return NOTIFICATION_SETTING_DEFAULTS[provider][type]


def _get_default_value_by_provider(
    type: NotificationSettingTypes,
    recipient: Team | User | None = None,
) -> Mapping[ExternalProviders, NotificationSettingOptionValues]:
    return {
        provider: _get_notification_setting_default(provider, type, recipient)
        for provider in NOTIFICATION_SETTING_DEFAULTS.keys()
    }


def _get_setting_mapping_from_mapping(
    notification_settings_by_recipient: Mapping[
        Team | User,
        Mapping[NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    recipient: Team | User,
    type: NotificationSettingTypes,
) -> Mapping[ExternalProviders, NotificationSettingOptionValues]:
    """
    XXX(CEO): may not respect granularity of a setting for Slack a setting for
     email but we'll worry about that later since we don't have a FE for it yet.
    """
    return merge_notification_settings_up(
        _get_default_value_by_provider(type, recipient),
        *(
            notification_settings_by_recipient.get(recipient, {}).get(scope, {})
            for scope in (
                NotificationScopeType.USER,
                NotificationScopeType.TEAM,
                get_scope_type(type),
            )
        ),
    )


def where_should_recipient_be_notified(
    notification_settings_by_recipient: Mapping[
        Team | User,
        Mapping[NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    recipient: Team | User,
    type: NotificationSettingTypes = NotificationSettingTypes.ISSUE_ALERTS,
) -> list[ExternalProviders]:
    """
    Given a mapping of default and specific notification settings by user,
    return the list of providers after verifying the user has opted into this notification.
    """
    mapping = _get_setting_mapping_from_mapping(
        notification_settings_by_recipient,
        recipient,
        type,
    )
    return [
        provider
        for provider, value in mapping.items()
        if value == NotificationSettingOptionValues.ALWAYS
    ]


def should_be_participating(
    subscription: Any | None,
    value: NotificationSettingOptionValues,
) -> bool:
    """
    Give an Actor's subscription (on, off, or null) to a group and their
    notification setting value(on, off, or sometimes), decide whether or not to
    send the Actor a notification.
    """
    return (
        subscription and subscription.is_active and value != NotificationSettingOptionValues.NEVER
    ) or (not subscription and value == NotificationSettingOptionValues.ALWAYS)


def where_should_be_participating(
    recipient: Team | User,
    subscription: GroupSubscription | None,
    notification_settings_by_recipient: Mapping[
        Team | User,
        Mapping[NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
) -> list[ExternalProviders]:
    """
    Given a mapping of users to subscriptions and a mapping of default and
    specific notification settings by user, determine where a user should receive
    a WORKFLOW notification. Unfortunately, this algorithm does not respect
    NotificationSettingOptionValues.ALWAYS. If the user is unsubscribed from
    the group, that overrides their notification preferences.
    """
    mapping = _get_setting_mapping_from_mapping(
        notification_settings_by_recipient,
        recipient,
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
    recipient: Team | User | None = None,
) -> Mapping[ExternalProviders, NotificationSettingOptionValues]:
    """
    Given a mapping of scopes to a mapping of default and specific notification
    settings by provider, determine the notification setting by provider for
    the given notification type.
    """
    parent_scope = get_scope_type(type)

    parent_specific_mapping = notification_settings_by_scope.get(parent_scope, {})
    organization_independent_mapping = (
        notification_settings_by_scope.get(NotificationScopeType.USER)
        or notification_settings_by_scope.get(NotificationScopeType.TEAM)
        or {}
    )

    return {
        provider: (
            parent_specific_mapping.get(provider)
            or organization_independent_mapping.get(provider)
            or _get_notification_setting_default(provider, type, recipient)
        )
        for provider in all_providers
    }


def transform_to_notification_settings_by_recipient(
    notification_settings: Iterable[NotificationSetting],
    recipients: Iterable[Team | User],
) -> Mapping[
    Team | User,
    Mapping[NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]],
]:
    """
    Given an unsorted list of notification settings, create a mapping of users
    to a map of notification scopes to setting values.
    """
    actor_mapping = {recipient.actor_id: recipient for recipient in recipients}
    notification_settings_by_recipient: MutableMapping[
        Team | User,
        MutableMapping[
            NotificationScopeType,
            MutableMapping[ExternalProviders, NotificationSettingOptionValues],
        ],
    ] = defaultdict(lambda: defaultdict(dict))
    for notification_setting in notification_settings:
        recipient = actor_mapping.get(notification_setting.target_id)
        scope_type = NotificationScopeType(notification_setting.scope_type)
        value = NotificationSettingOptionValues(notification_setting.value)
        provider = ExternalProviders(notification_setting.provider)
        notification_settings_by_recipient[recipient][scope_type][provider] = value
    return notification_settings_by_recipient


def transform_to_notification_settings_by_scope(
    notification_settings: Iterable[NotificationSetting],
) -> Mapping[
    NotificationScopeType,
    Mapping[int, Mapping[ExternalProviders, NotificationSettingOptionValues]],
]:
    """
    Given an unsorted list of notification settings, create a mapping of scopes
    (user or parent) and their IDs to a map of provider to notifications setting values.
    """
    notification_settings_by_scopes: MutableMapping[
        NotificationScopeType,
        MutableMapping[int, MutableMapping[ExternalProviders, NotificationSettingOptionValues]],
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
    if type in [
        NotificationSettingTypes.DEPLOY,
        NotificationSettingTypes.APPROVAL,
        NotificationSettingTypes.QUOTA,
        NotificationSettingTypes.QUOTA_ERRORS,
        NotificationSettingTypes.QUOTA_TRANSACTIONS,
        NotificationSettingTypes.QUOTA_ATTACHMENTS,
        NotificationSettingTypes.QUOTA_WARNINGS,
        NotificationSettingTypes.QUOTA_SPEND_ALLOCATIONS,
    ]:
        return NotificationScopeType.ORGANIZATION

    if type in [
        NotificationSettingTypes.WORKFLOW,
        NotificationSettingTypes.ISSUE_ALERTS,
        NotificationSettingTypes.ACTIVE_RELEASE,
        NotificationSettingTypes.SPIKE_PROTECTION,
    ]:
        return NotificationScopeType.PROJECT

    raise Exception(
        f"type {type}, must be alerts, deploy, workflow, approval, quota, quotaErrors, quotaTransactions, quotaAttachments, quotaWarnings, quotaSpendAllocations, spikeProtection"
    )


def get_scope(
    user: User | None = None,
    team: Team | None = None,
    project: Project | None = None,
    organization: Organization | None = None,
) -> tuple[NotificationScopeType, int]:
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


def get_target_id(user: User | None = None, team: Team | None = None) -> int:
    """:returns the actor ID from a User or Team."""
    if user:
        return int(user.actor_id)
    if team:
        return int(team.actor_id)

    raise Exception("target must be either a user or a team")


def get_subscription_from_attributes(
    attrs: Mapping[str, Any]
) -> tuple[bool, Mapping[str, str | bool] | None]:
    subscription_details: Mapping[str, str | bool] | None = None
    is_disabled, is_subscribed, subscription = attrs["subscription"]
    if is_disabled:
        subscription_details = {"disabled": True}
    elif subscription and subscription.is_active:
        subscription_details = {
            "reason": SUBSCRIPTION_REASON_MAP.get(subscription.reason, "unknown")
        }

    return is_subscribed, subscription_details


def get_groups_for_query(
    groups_by_project: Mapping[Project, set[Group]],
    notification_settings_by_scope: Mapping[
        NotificationScopeType,
        Mapping[int, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    user: User,
) -> set[Group]:
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
            recipient=user,
            parent_id=project.id,
            type=NotificationSettingTypes.WORKFLOW,
        )
        if value != NotificationSettingOptionValues.NEVER:
            output |= groups
    return output


def collect_groups_by_project(groups: Iterable[Group]) -> Mapping[Project, set[Group]]:
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
    groups_by_project: Mapping[Project, set[Group]],
    notification_settings_by_scope: Mapping[
        NotificationScopeType,
        Mapping[int, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    subscriptions_by_group_id: Mapping[int, GroupSubscription],
    user: User,
) -> Mapping[int, tuple[bool, bool, GroupSubscription | None]]:
    """
    For each group, use the combination of GroupSubscription and
    NotificationSetting rows to determine if the user is explicitly or
    implicitly subscribed (or if they can subscribe at all.)
    """
    results = {}
    for project, groups in groups_by_project.items():
        notification_settings_by_provider = get_values_by_provider(
            notification_settings_by_scope,
            recipient=user,
            parent_id=project.id,
            type=NotificationSettingTypes.WORKFLOW,
        )
        for group in groups:
            results[group.id] = _get_subscription_values(
                group,
                subscriptions_by_group_id,
                notification_settings_by_provider,
            )
    return results


def _get_subscription_values(
    group: Group,
    subscriptions_by_group_id: Mapping[int, GroupSubscription],
    notification_settings_by_provider: Mapping[ExternalProviders, NotificationSettingOptionValues],
) -> tuple[bool, bool, GroupSubscription | None]:
    is_disabled = False
    subscription = subscriptions_by_group_id.get(group.id)
    if subscription:
        # Having a GroupSubscription overrides NotificationSettings.
        is_active = subscription.is_active
    else:
        value = get_highest_notification_setting_value(notification_settings_by_provider)
        if value == NotificationSettingOptionValues.NEVER:
            # The user has disabled notifications in all cases.
            is_disabled = True
            is_active = False
        else:
            # Since there is no subscription, it is only active if the value is ALWAYS.
            is_active = value == NotificationSettingOptionValues.ALWAYS

    return is_disabled, is_active, subscription


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
    recipient: Team | User | None = None,
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

            if recipient:
                # Each provider has it's own defaults by type.
                value = _get_notification_setting_default(provider, type_enum, recipient)
                value_str = NOTIFICATION_SETTING_OPTION_VALUES[value]
                user_scope_str = NOTIFICATION_SCOPE_TYPE[NotificationScopeType.USER]

                data[type_str][user_scope_str][recipient.id][provider_str] = value_str
    return data


def get_reason_context(extra_context: Mapping[str, Any]) -> MutableMapping[str, str]:
    """Get user-specific context. Do not call get_context() here."""
    reason = extra_context.get("reason", 0)
    return {
        "reason": GroupSubscriptionReason.descriptions.get(reason, "are subscribed to this issue")
    }


def get_highest_notification_setting_value(
    notification_settings_by_provider: Mapping[ExternalProviders, NotificationSettingOptionValues],
) -> NotificationSettingOptionValues | None:
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


def get_value_for_parent(
    notification_settings_by_scope: Mapping[
        NotificationScopeType,
        Mapping[int, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    parent_id: int,
    type: NotificationSettingTypes,
) -> Mapping[ExternalProviders, NotificationSettingOptionValues]:
    """
    Given notification settings by scope, an organization or project, and a
    notification type, get the notification settings by provider.
    """
    return notification_settings_by_scope.get(get_scope_type(type), {}).get(parent_id, {})


def get_value_for_actor(
    notification_settings_by_scope: Mapping[
        NotificationScopeType,
        Mapping[int, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    recipient: Team | User,
) -> Mapping[ExternalProviders, NotificationSettingOptionValues]:
    """
    Instead of checking the DB to see if `recipient` is a Team or User, just
    `get()` both since only one of them can have a value.
    """
    return (
        notification_settings_by_scope.get(NotificationScopeType.USER)
        or notification_settings_by_scope.get(NotificationScopeType.TEAM)
        or {}
    ).get(recipient.id, {})


def get_most_specific_notification_setting_value(
    notification_settings_by_scope: Mapping[
        NotificationScopeType,
        Mapping[int, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    recipient: Team | User,
    parent_id: int,
    type: NotificationSettingTypes,
) -> NotificationSettingOptionValues:
    """
    Get the "most specific" notification setting value for a given user and
    project. If there are no settings, default to the default setting for EMAIL.
    """
    return (
        get_highest_notification_setting_value(
            get_value_for_parent(notification_settings_by_scope, parent_id, type)
        )
        or get_highest_notification_setting_value(
            get_value_for_actor(notification_settings_by_scope, recipient)
        )
        or _get_notification_setting_default(ExternalProviders.EMAIL, type, recipient)
    )


def merge_notification_settings_up(
    *settings_mappings: Mapping[ExternalProviders, NotificationSettingOptionValues],
) -> Mapping[ExternalProviders, NotificationSettingOptionValues]:
    """
    Given a list of notification settings by provider ordered by increasing
    specificity, get the most specific value by provider.
    """
    value_by_provider: MutableMapping[ExternalProviders, NotificationSettingOptionValues] = {}
    for notification_settings_by_provider in settings_mappings:
        value_by_provider.update(notification_settings_by_provider)
    return value_by_provider


def get_values_by_provider(
    notification_settings_by_scope: Mapping[
        NotificationScopeType,
        Mapping[int, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    recipient: Team | User,
    parent_id: int,
    type: NotificationSettingTypes,
) -> Mapping[ExternalProviders, NotificationSettingOptionValues]:
    """
    Given notification settings by scope, an organization or project, a
    recipient, and a notification type, what is the non-never notification
    setting by provider?
    """
    return merge_notification_settings_up(
        _get_default_value_by_provider(type, recipient),
        get_value_for_actor(notification_settings_by_scope, recipient),
        get_value_for_parent(notification_settings_by_scope, parent_id, type),
    )


def get_providers_for_recipient(recipient: User | Team) -> Iterable[ExternalProviders]:
    from sentry.models import ExternalActor, Identity, Team

    possible_providers = NOTIFICATION_SETTING_DEFAULTS.keys()
    if isinstance(recipient, Team):
        return list(
            map(
                get_provider_enum,
                ExternalActor.objects.filter(
                    actor_id=recipient.actor_id, provider__in=possible_providers
                ).values_list("provider", flat=True),
            )
        )

    return list(
        map(
            get_provider_enum_from_string,
            Identity.objects.filter(
                user=recipient, idp__type__in=list(map(get_provider_name, possible_providers))
            ).values_list("idp__type", flat=True),
        )
    ) + [
        ExternalProviders.EMAIL
    ]  # always add in email as an option
