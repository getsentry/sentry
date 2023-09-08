from __future__ import annotations

from collections import defaultdict
from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping, Optional

from django.contrib.auth.models import AnonymousUser
from django.db.models import Q

from sentry import features
from sentry.models.notificationsettingoption import NotificationSettingOption
from sentry.models.notificationsettingprovider import NotificationSettingProvider
from sentry.models.user import User
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.notifications.defaults import (
    NOTIFICATION_SETTING_DEFAULTS,
    NOTIFICATION_SETTINGS_ALL_SOMETIMES,
    NOTIFICATION_SETTINGS_ALL_SOMETIMES_V2,
)
from sentry.notifications.types import (
    NOTIFICATION_SCOPE_TYPE,
    NOTIFICATION_SETTING_OPTION_VALUES,
    NOTIFICATION_SETTING_TYPES,
    SUBSCRIPTION_REASON_MAP,
    VALID_VALUES_FOR_KEY,
    VALID_VALUES_FOR_KEY_V2,
    GroupSubscriptionReason,
    NotificationScopeEnum,
    NotificationScopeType,
    NotificationSettingEnum,
    NotificationSettingOptionValues,
    NotificationSettingsOptionEnum,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud import extract_id_from
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.notifications import RpcNotificationSetting
from sentry.services.hybrid_cloud.user.model import RpcUser
from sentry.types.integrations import (
    EXTERNAL_PROVIDERS,
    ExternalProviderEnum,
    ExternalProviders,
    get_provider_enum_from_string,
    get_provider_name,
)

if TYPE_CHECKING:
    from sentry.models import Group, GroupSubscription, Organization, Project, Team  # noqa: S005


def _get_notification_setting_default(
    provider: ExternalProviders,
    type: NotificationSettingTypes,
    recipient: RpcActor | None = None,  # not needed right now
) -> NotificationSettingOptionValues:
    """
    In order to increase engagement, we automatically opt users into receiving
    Slack notifications if they install Slack and link their identity.
    Approval notifications always default to Slack being on.
    """

    # every team default is off
    if recipient is not None and recipient.actor_type == ActorType.TEAM:
        return NotificationSettingOptionValues.NEVER
    return NOTIFICATION_SETTING_DEFAULTS[provider][type]


def _get_default_value_by_provider(
    type: NotificationSettingTypes,
    recipient: RpcActor | None = None,
) -> Mapping[ExternalProviders, NotificationSettingOptionValues]:
    return {
        provider: _get_notification_setting_default(provider, type, recipient)
        for provider in NOTIFICATION_SETTING_DEFAULTS.keys()
    }


def get_provider_defaults() -> list[ExternalProviderEnum]:
    # create the data structure outside the endpoint
    provider_defaults = []
    for key, value in NOTIFICATION_SETTING_DEFAULTS.items():
        provider = EXTERNAL_PROVIDERS[key]
        # if the value is NOTIFICATION_SETTINGS_ALL_SOMETIMES then it means the provider
        # is on by default
        if value == NOTIFICATION_SETTINGS_ALL_SOMETIMES:
            provider_defaults.append(ExternalProviderEnum(provider))
    return provider_defaults


def get_type_defaults() -> Mapping[NotificationSettingEnum, NotificationSettingsOptionEnum]:
    # this tells us what the default value is for each notification type
    type_defaults = {}
    for key, value in NOTIFICATION_SETTINGS_ALL_SOMETIMES_V2.items():
        # for the given notification type, figure out what the default value is
        notification_type = NotificationSettingEnum(NOTIFICATION_SETTING_TYPES[key])
        default = NotificationSettingsOptionEnum(NOTIFICATION_SETTING_OPTION_VALUES[value])
        type_defaults[notification_type] = default
    return type_defaults


def _get_setting_mapping_from_mapping(
    notification_settings_by_recipient: Mapping[
        RpcActor,
        Mapping[NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    recipient: RpcActor,
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
        RpcActor,
        Mapping[NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    recipient: RpcActor,
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
    recipient: RpcActor,
    subscription: GroupSubscription | None,
    notification_settings_by_recipient: Mapping[
        RpcActor,
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
    recipient: RpcActor | None = None,
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
    notification_settings: Iterable[RpcNotificationSetting],
    recipients: Iterable[RpcActor],
) -> Mapping[
    RpcActor,
    Mapping[NotificationScopeType, Mapping[ExternalProviders, NotificationSettingOptionValues]],
]:
    """
    Given an unsorted list of notification settings, create a mapping of users
    to a map of notification scopes to setting values.
    """
    team_mapping = {r.id: r for r in recipients if r.actor_type == ActorType.TEAM}
    user_mapping = {r.id: r for r in recipients if r.actor_type == ActorType.USER}

    notification_settings_by_recipient: MutableMapping[
        RpcActor,
        MutableMapping[
            NotificationScopeType,
            MutableMapping[ExternalProviders, NotificationSettingOptionValues],
        ],
    ] = defaultdict(lambda: defaultdict(dict))
    for ns in notification_settings:
        if ns.team_id is not None:
            recipient = team_mapping[ns.team_id]
        else:
            assert ns.user_id is not None
            recipient = user_mapping[ns.user_id]
        scope_type = NotificationScopeType(ns.scope_type)
        value = NotificationSettingOptionValues(ns.value)
        provider = ExternalProviders(ns.provider)
        notification_settings_by_recipient[recipient][scope_type][provider] = value
    return notification_settings_by_recipient


def transform_to_notification_settings_by_scope(
    notification_settings: Iterable[RpcNotificationSetting],
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


def validate_v2(type: NotificationSettingTypes, value: NotificationSettingOptionValues) -> bool:
    """:returns boolean. True if the "value" is valid for the "type"."""
    return value in VALID_VALUES_FOR_KEY_V2.get(type, {})


def get_scope_type(type: NotificationSettingTypes) -> NotificationScopeType:
    """In which scope (proj or org) can a user set more specific settings?"""
    if type in [
        NotificationSettingTypes.DEPLOY,
        NotificationSettingTypes.APPROVAL,
        NotificationSettingTypes.QUOTA,
        NotificationSettingTypes.QUOTA_ERRORS,
        NotificationSettingTypes.QUOTA_TRANSACTIONS,
        NotificationSettingTypes.QUOTA_ATTACHMENTS,
        NotificationSettingTypes.QUOTA_REPLAYS,
        NotificationSettingTypes.QUOTA_WARNINGS,
        NotificationSettingTypes.QUOTA_SPEND_ALLOCATIONS,
    ]:
        return NotificationScopeType.ORGANIZATION

    if type in [
        NotificationSettingTypes.WORKFLOW,
        NotificationSettingTypes.ISSUE_ALERTS,
        NotificationSettingTypes.SPIKE_PROTECTION,
    ]:
        return NotificationScopeType.PROJECT

    raise Exception(
        f"type {type}, must be alerts, deploy, workflow, approval, quota, quotaErrors, quotaTransactions, quotaAttachments, quotaReplays, quotaWarnings, quotaSpendAllocations, spikeProtection"
    )


def get_scope(
    user: User | int | None = None,
    team: Team | int | None = None,
    project: Project | int | None = None,
    organization: Organization | int | None = None,
) -> tuple[NotificationScopeType, int]:
    """
    Figure out the scope from parameters and return it as a tuple.
    TODO(mgaeta): Make sure the user/team is in the project/organization.
    """
    if project:
        return NotificationScopeType.PROJECT, extract_id_from(project)

    if organization:
        return NotificationScopeType.ORGANIZATION, extract_id_from(organization)

    if user is not None:
        return NotificationScopeType.USER, extract_id_from(user)
    if team is not None:
        return NotificationScopeType.TEAM, extract_id_from(team)

    raise Exception("scope must be either user, team, organization, or project")


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
    groups_by_project: Mapping[int, set[Group]],
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

    # Avoid n queries for actors.
    actor = RpcActor.from_object(user)

    # Although this can be done with a comprehension, looping for clarity.
    output = set()
    for project_id, groups in groups_by_project.items():
        value = get_most_specific_notification_setting_value(
            notification_settings_by_scope,
            recipient=actor,
            parent_id=project_id,
            type=NotificationSettingTypes.WORKFLOW,
        )
        if value != NotificationSettingOptionValues.NEVER:
            output |= groups
    return output


def collect_groups_by_project(groups: Iterable[Group]) -> Mapping[int, set[Group]]:
    """
    Collect all of the projects to look up, and keep a set of groups that are
    part of that project. (Note that the common -- but not only -- case here is
    that all groups are part of the same project.)
    """
    projects = defaultdict(set)
    for group in groups:
        projects[group.project_id].add(group)
    return projects


def get_user_subscriptions_for_groups(
    groups_by_project: Mapping[int, set[Group]],
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
    actor = RpcActor.from_orm_user(user)
    for project_id, groups in groups_by_project.items():
        notification_settings_by_provider = get_values_by_provider(
            notification_settings_by_scope,
            recipient=actor,
            parent_id=project_id,
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
    recipient: RpcActor | None = None,
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


def _get_value_for_actor(
    notification_settings_by_scope: Mapping[
        NotificationScopeType,
        Mapping[int, Mapping[ExternalProviders, NotificationSettingOptionValues]],
    ],
    recipient: RpcActor,
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
    recipient: RpcActor | AnonymousUser,
    parent_id: int,
    type: NotificationSettingTypes,
) -> NotificationSettingOptionValues:
    """
    Get the "most specific" notification setting value for a given user and
    project. If there are no settings, default to the default setting for EMAIL.
    """
    if isinstance(recipient, AnonymousUser):
        return _get_notification_setting_default(ExternalProviders.EMAIL, type, None)

    recipient_actor = RpcActor.from_object(recipient)
    return (
        get_highest_notification_setting_value(
            get_value_for_parent(notification_settings_by_scope, parent_id, type)
        )
        or get_highest_notification_setting_value(
            _get_value_for_actor(notification_settings_by_scope, recipient_actor)
        )
        or _get_notification_setting_default(ExternalProviders.EMAIL, type, recipient_actor)
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
    recipient: RpcActor,
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
        _get_value_for_actor(notification_settings_by_scope, recipient),
        get_value_for_parent(notification_settings_by_scope, parent_id, type),
    )


def get_providers_for_recipient(
    recipient: User,
) -> Iterable[ExternalProviders]:
    from sentry.models.identity import Identity

    possible_providers = NOTIFICATION_SETTING_DEFAULTS.keys()
    provider_names = [get_provider_name(provider.value) for provider in possible_providers]
    idp_types = Identity.objects.filter(
        user__id=recipient.id, idp__type__in=provider_names
    ).values_list("idp__type", flat=True)
    user_providers = [get_provider_enum_from_string(idp_type) for idp_type in idp_types]
    user_providers.append(ExternalProviders.EMAIL)  # always add in email as an option
    return user_providers


def recipient_is_user(recipient: RpcActor | Team | User) -> bool:
    from sentry.models.user import User

    if isinstance(recipient, RpcActor) and recipient.actor_type == ActorType.USER:
        return True
    return isinstance(recipient, (RpcUser, User))


def recipient_is_team(recipient: RpcActor | Team | User) -> bool:
    from sentry.models.team import Team

    if isinstance(recipient, RpcActor) and recipient.actor_type == ActorType.TEAM:
        return True
    return isinstance(recipient, Team)


def get_query(
    recipients: Iterable[RpcActor | Team | User] | None = None,
    projects: Iterable[Project] | None = None,
    organization: Organization | None = None,
) -> Q:
    """
    Generates a query for all settings for a project, org, user, or team.

    Args:
        recipient: The recipient of the notification settings (user or team).
        project: The project to get notification settings for.
        organization: The organization to get notification settings for.
        user_ids: The user ids to get notification settings for.
    """
    if not recipients:
        raise Exception("recipient, team_ids, or user_ids must be provided")

    user_ids, team_ids = [], []
    for recipient in recipients:
        if recipient_is_user(recipient):
            user_ids.append(recipient.id)
        elif recipient_is_team(recipient):
            team_ids.append(recipient.id)

    if not user_ids and not team_ids:
        raise Exception("recipients must be either user or team")

    project_settings = (
        Q(
            (Q(user_id__in=user_ids) | Q(team_id__in=team_ids)),
            scope_type=NotificationScopeEnum.PROJECT.value,
            scope_identifier__in=[project.id for project in projects],
        )
        if projects
        else Q()
    )

    org_id = (
        organization.id
        if organization
        else (projects[0].organization.id if projects else None)  # type:ignore
    )
    org_settings = (
        Q(
            (Q(user_id__in=user_ids) | Q(team_id__in=team_ids)),
            scope_type=NotificationScopeEnum.ORGANIZATION.value,
            scope_identifier=org_id,
        )
        if organization or projects
        else Q()
    )

    team_or_user_settings = Q(
        (Q(user_id__in=user_ids) | Q(team_id__in=team_ids)),
        scope_type=NotificationScopeEnum.USER.value,
        scope_identifier__in=user_ids,
    )

    return project_settings | org_settings | team_or_user_settings


def get_all_setting_providers(
    recipients: Iterable[RpcActor | Team | User] | None = None,
    project: Project | None = None,
    organization: Organization | None = None,
) -> Iterable[NotificationSettingProvider]:
    """
    Returns all NotificationSettingProviders for given recipients.
    Recipients can be either a user or a team, or a list of user ids.

    Args:
        recipient: The recipient of the notification settings (user or team).
        project: The project to get notification settings for.
        organization: The organization to get notification settings for.
        user_ids: The user ids to get notification settings for.
    """

    projects = [project] if project else []
    query = get_query(recipients, projects, organization)
    return NotificationSettingProvider.objects.filter(query)


def get_all_setting_options(
    recipients: Iterable[RpcActor | Team | User] | None = None,
    project: Project | None = None,
    organization: Organization | None = None,
) -> Iterable[NotificationSettingOption]:
    """
    Returns all NotificationSettingOption for given recipients.
    Recipients can be either a user or a team, or a list of user ids.

    Args:
        recipient: The recipient of the notification settings (user or team).
        project: The project to get notification settings for.
        organization: The organization to get notification settings for.
        user_ids: The user ids to get notification settings for.
    """
    projects = [project] if project else []
    query = get_query(recipients, projects, organization)
    return NotificationSettingOption.objects.filter(query)


def get_setting_options_for_recipient(
    recipient: RpcActor | Team | User,
    project: Project | None = None,
    organization: Organization | None = None,
) -> MutableMapping[NotificationSettingEnum, NotificationSettingsOptionEnum]:
    all_settings = get_all_setting_options([recipient], project, organization)

    notification_settings = {}
    # Project settings take precedence over all other notification settings
    for setting in all_settings:
        if setting.scope_type == NotificationScopeEnum.PROJECT.value:
            notification_settings[
                NotificationSettingEnum(setting.type)
            ] = NotificationSettingsOptionEnum(setting.value)

    # Organization settings apply when project settings are not set
    for setting in all_settings:
        if setting.scope_type == NotificationScopeEnum.ORGANIZATION.value:
            setting_type = NotificationSettingEnum(setting.type)
            if setting_type not in notification_settings:
                notification_settings[setting_type] = NotificationSettingsOptionEnum(setting.value)

    # Team/User settings are the most specific.
    if recipient_is_user(recipient):
        scope_type = NotificationScopeEnum.USER.value
    elif recipient_is_team(recipient):
        scope_type = NotificationScopeEnum.TEAM.value
    else:
        raise Exception("recipient must be either user or team")

    for setting in all_settings:
        if setting.scope_type == scope_type:
            setting_type = NotificationSettingEnum(setting.type)
            if setting_type not in notification_settings:
                notification_settings[setting_type] = NotificationSettingsOptionEnum(setting.value)

    # Fill in any missing settings with the default
    defaults = get_type_defaults()
    for type in NotificationSettingEnum:
        if type not in notification_settings and type in defaults:
            notification_settings[type] = defaults[type]

    return notification_settings


def get_setting_options_for_users(
    user_ids: Iterable[int],
    project: Project | None = None,
    organization: Organization | None = None,
    additional_filters: Q | None = None,
) -> MutableMapping[
    RpcActor,
    MutableMapping[NotificationSettingEnum, NotificationSettingsOptionEnum],
]:
    """
    Returns a map of users to NotificationSettingOption by type:
    {user -> {notification type -> setting}}.

    Args:
        user_ids: The user ids to get notification settings for.
        project: The project to get notification settings for.
        organization: The organization to get notification settings for.
    """
    if not additional_filters:
        additional_filters = Q()

    users = User.objects.filter(id__in=user_ids)
    projects = [project] if project else []
    query = get_query(recipients=users, projects=projects, organization=organization)
    notification_settings = NotificationSettingOption.objects.filter(query & additional_filters)

    user_to_setting: MutableMapping[
        RpcActor, MutableMapping[NotificationSettingEnum, NotificationSettingOption]
    ] = defaultdict(dict)
    for ns in notification_settings:
        ns_dict = user_to_setting[ns.user]
        setting_type = NotificationSettingEnum(ns.type)
        if ns.scope_type == NotificationScopeEnum.PROJECT.value:
            # Project settings take precedence, so we can overwrite any existing settings.
            ns_dict[setting_type] = ns

        if ns.scope_type == NotificationScopeEnum.ORGANIZATION.value:
            if setting_type not in ns_dict:
                ns_dict[setting_type] = ns
            else:
                # Organization settings do not override project settings
                if ns_dict[setting_type].scope_type != NotificationScopeEnum.PROJECT.value:
                    ns_dict[setting_type] = ns

        if ns.scope_type == NotificationScopeEnum.USER.value:
            if setting_type not in ns_dict:
                ns_dict[setting_type] = ns
            else:
                # User settings do not override project or organization settings
                if ns_dict[setting_type].scope_type not in [
                    NotificationScopeEnum.PROJECT.value,
                    NotificationScopeEnum.ORGANIZATION.value,
                ]:
                    ns_dict[setting_type] = ns

    # Replace the NotificationSettingOption object with the setting value
    result: MutableMapping[
        RpcActor, MutableMapping[NotificationSettingEnum, NotificationSettingsOptionEnum]
    ] = {
        user: {
            setting_type: NotificationSettingsOptionEnum(ns.value)
            for setting_type, ns in setting.items()
        }
        for user, setting in user_to_setting.items()
    }

    # Fill in the setting defaults if they are missing
    defaults = get_type_defaults()
    for _, res_dict in result.items():
        for type in NotificationSettingEnum:
            if type not in res_dict and type in defaults:
                res_dict[type] = defaults[type]

    return result


def get_layered_setting_providers(
    user_ids: Iterable[int],
    projects: Iterable[Project] | None = None,
    organization: Organization | None = None,
    additional_filters: Q | None = None,
):
    """
    Returns a map of users to NotificationSettingProvider by provider:
    {user -> {provider -> setting}}. NOTE: this does not include the default settings.

    Args:
        user_ids: The user ids to get notification settings for.
        project: The project to get notification settings for.
        organization: The organization to get notification settings for.
        additional_filters: Additional filters to apply to the query for NotificationSettingProvider.
    """

    if not additional_filters:
        additional_filters = Q()
    users = User.objects.filter(id__in=user_ids)
    query = get_query(recipients=users, projects=projects, organization=organization)
    notification_settings = NotificationSettingProvider.objects.filter(query & additional_filters)

    user_to_setting: MutableMapping[
        RpcActor, MutableMapping[ExternalProviderEnum, NotificationSettingProvider]
    ] = defaultdict(dict)
    for ns in notification_settings:
        ns_dict = user_to_setting[ns.user]
        provider = ExternalProviderEnum(ns.provider)
        if ns.scope_type == NotificationScopeEnum.PROJECT.value:
            # Project settings take precedence, so we can overwrite any existing settings.
            ns_dict[provider] = ns

        if ns.scope_type == NotificationScopeEnum.ORGANIZATION.value:
            if provider not in ns_dict:
                ns_dict[provider] = ns
            else:
                # Organization settings do not override project settings
                if ns_dict[provider].scope_type != NotificationScopeEnum.PROJECT.value:
                    ns_dict[provider] = ns

        if ns.scope_type == NotificationScopeEnum.USER.value:
            if provider not in ns_dict:
                ns_dict[provider] = ns
            else:
                # User settings do not override project or organization settings
                if ns_dict[provider].scope_type not in [
                    NotificationScopeEnum.PROJECT.value,
                    NotificationScopeEnum.ORGANIZATION.value,
                ]:
                    ns_dict[provider] = ns
    return user_to_setting


def get_setting_providers_for_projects(
    user_ids: Iterable[int],
    projects: Iterable[Project],
    organization: Organization | None = None,
    additional_filters: Q | None = None,
) -> MutableMapping[int, MutableMapping[ExternalProviderEnum, NotificationSettingsOptionEnum]]:
    """
    Returns a map of project id to NotificationSettingProvider by provider:
    {project id -> {provider -> setting}}.

    Args:
        user_ids: The user ids to get notification settings for.
        project: The project to get notification settings for.
        organization: The organization to get notification settings for.
        additional_filters: Additional filters to apply to the query for NotificationSettingProvider.
    """
    user_to_setting = get_layered_setting_providers(
        user_ids, projects, organization, additional_filters
    )

    result: MutableMapping[
        int,
        MutableMapping[ExternalProviderEnum, NotificationSettingsOptionEnum],
    ]
    for project in projects:
        settings = user_to_setting.values()
        for setting in settings:
            result[project.id] = {
                provider: NotificationSettingsOptionEnum(ns.value)
                for provider, ns in setting.items()
            }

    provider_defaults = get_provider_defaults()
    for _, res_dict in result.items():
        for provider in ExternalProviderEnum:
            if provider not in res_dict and provider in provider_defaults:
                res_dict[provider] = NotificationSettingsOptionEnum.ALWAYS
    return result


def get_setting_providers_for_users(
    user_ids: Iterable[int],
    project: Project | None = None,
    organization: Organization | None = None,
    additional_filters: Q | None = None,
) -> MutableMapping[RpcActor, MutableMapping[ExternalProviderEnum, NotificationSettingsOptionEnum]]:
    """
    Returns a map of users to NotificationSettingProvider by provider:
    {user -> {provider -> setting}}.

    Args:
        user_ids: The user ids to get notification settings for.
        project: The project to get notification settings for.
        organization: The organization to get notification settings for.
        additional_filters: Additional filters to apply to the query for NotificationSettingProvider.
    """
    user_to_setting = get_layered_setting_providers(
        user_ids, [project] if project else None, organization, additional_filters
    )

    result: MutableMapping[
        RpcActor, MutableMapping[ExternalProviderEnum, NotificationSettingsOptionEnum]
    ] = {
        user: {
            provider: NotificationSettingsOptionEnum(ns.value) for provider, ns in setting.items()
        }
        for user, setting in user_to_setting.items()
    }

    provider_defaults = get_provider_defaults()
    for _, res_dict in result.items():
        for provider in ExternalProviderEnum:
            if provider not in res_dict and provider in provider_defaults:
                res_dict[provider] = NotificationSettingsOptionEnum.ALWAYS
    return result


def get_notification_recipients(project: Project) -> Mapping[ExternalProviderEnum, set[RpcActor]]:
    """
    Returns the recipients that should be notified for each provider.

    Args:
        project: The project to get notification settings for.
    """
    user_ids = project.member_set.values_list("user_id", flat=True)
    options = get_setting_options_for_users(user_ids, project=project)
    providers = get_setting_providers_for_users(user_ids, project=project)

    enabled_providers: Mapping[
        RpcActor, Mapping[ExternalProviderEnum, NotificationSettingsOptionEnum]
    ] = {
        user: {
            provider: ps
            for provider, ps in setting.items()
            if ps != NotificationSettingsOptionEnum.NEVER
        }
        for user, setting in providers.items()
    }

    recipients: Mapping[ExternalProviderEnum, set[RpcActor]] = defaultdict(set)
    for user in options.keys():
        user_providers = enabled_providers[user].keys()
        for provider in user_providers:
            recipients[provider].add(user)

    return recipients


def user_has_any_provider_settings(
    recipient: RpcActor | Team | User, provider: ExternalProviderEnum
) -> bool:
    """
    Returns whether the recipient has any notification settings for the given provider.

    Args:
        recipient: The recipient of the notification settings (user or team).
        provider: The provider to check for.
    """
    settings = get_all_setting_providers([recipient])
    for setting in settings:
        if not setting.provider == provider.value:
            continue

        if setting.value == NotificationSettingsOptionEnum.ALWAYS.value:
            return True

    return False


def is_double_write_enabled(
    user_id: Optional[int] = None, organization_id_for_team: Optional[int] = None
):
    from sentry.services.hybrid_cloud.organization_mapping.serial import (
        serialize_organization_mapping,
    )

    # all operations are expected to happen in the control siolo
    if organization_id_for_team is not None:
        org_ids = [organization_id_for_team]
    elif user_id is not None:
        org_ids = OrganizationMemberMapping.objects.filter(user_id=user_id).values_list(
            "organization_id", flat=True
        )
    else:
        raise ValueError("Need organization_id_for_team or user_id")
    orgs = list(
        map(
            serialize_organization_mapping,
            OrganizationMapping.objects.filter(organization_id__in=list(org_ids)),
        )
    )
    return any(features.has("organizations:notifications-double-write", org) for org in orgs)


PROVIDER_DEFAULTS: list[ExternalProviderEnum] = get_provider_defaults()
TYPE_DEFAULTS: Mapping[
    NotificationSettingEnum, NotificationSettingsOptionEnum
] = get_type_defaults()
