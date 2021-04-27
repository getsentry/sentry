from collections import defaultdict
from typing import Iterable, Mapping, MutableMapping, Optional, Set

from sentry.models import (
    Group,
    GroupSubscription,
    NotificationSetting,
    Organization,
    Project,
    User,
    UserOption,
)
from sentry.notifications.helpers import (
    get_deploy_values_by_provider,
    transform_to_notification_settings_by_user,
)
from sentry.notifications.notify import notification_providers
from sentry.notifications.types import (
    GroupSubscriptionReason,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.types.integrations import ExternalProviders


def get_providers_from_which_to_remove_user(
    user: User,
    participants_by_provider: Mapping[ExternalProviders, Mapping[User, int]],
) -> Set[ExternalProviders]:
    """
    Given a mapping of provider to mappings of users to why they should receive
    notifications for an activity, return the set of providers where the user
    has opted out of receiving notifications.
    """

    providers = {
        provider
        for provider, participants in participants_by_provider.items()
        if user in participants
    }
    if (
        providers
        and UserOption.objects.get_value(user, key="self_notifications", default="0") == "0"
    ):
        return providers
    return set()


def get_participants_for_group(
    group: Group, user: Optional[User] = None
) -> Mapping[ExternalProviders, Mapping[User, int]]:
    # TODO(dcramer): not used yet today except by Release's
    if not group:
        return {}

    participants_by_provider: MutableMapping[
        ExternalProviders, MutableMapping[User, int]
    ] = GroupSubscription.objects.get_participants(group)
    if user:
        # Optionally remove the actor that created the activity from the recipients list.
        providers = get_providers_from_which_to_remove_user(user, participants_by_provider)
        for provider in providers:
            del participants_by_provider[provider][user]

    return participants_by_provider


def get_reason(
    user: User, value: NotificationSettingOptionValues, user_ids: Set[int]
) -> Optional[int]:
    # Members who opt into all deploy emails.
    if value == NotificationSettingOptionValues.ALWAYS:
        return GroupSubscriptionReason.deploy_setting

    # Members which have been seen in the commit log.
    elif value == NotificationSettingOptionValues.COMMITTED_ONLY and user.id in user_ids:
        return GroupSubscriptionReason.committed
    return None


def get_participants_for_release(
    projects: Iterable[Project], organization: Organization, user_ids: Set[int]
) -> Mapping[ExternalProviders, Mapping[User, int]]:
    # Collect all users with verified emails on a team in the related projects.
    users = list(User.objects.get_team_members_with_verified_email_for_projects(projects))

    # Get all the involved users' settings for deploy-emails (including
    # users' organization-independent settings.)
    notification_settings = NotificationSetting.objects.get_for_users_by_parent(
        NotificationSettingTypes.DEPLOY,
        users=users,
        parent=organization,
    )
    notification_settings_by_user = transform_to_notification_settings_by_user(
        notification_settings, users
    )

    # Map users to their setting value. Prioritize user/org specific, then
    # user default, then product default.
    users_to_reasons_by_provider: MutableMapping[
        ExternalProviders, MutableMapping[User, int]
    ] = defaultdict(dict)
    for user in users:
        notification_settings_by_scope = notification_settings_by_user.get(user, {})
        values_by_provider = get_deploy_values_by_provider(
            notification_settings_by_scope, notification_providers()
        )
        for provider, value in values_by_provider.items():
            reason_option = get_reason(user, value, user_ids)
            if reason_option:
                users_to_reasons_by_provider[provider][user] = reason_option
    return users_to_reasons_by_provider
