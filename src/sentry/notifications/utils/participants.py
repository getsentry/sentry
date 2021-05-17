import logging
from collections import defaultdict
from typing import Any, Iterable, Mapping, MutableMapping, Optional, Set, Tuple, Union

from sentry.models import (
    Group,
    GroupSubscription,
    NotificationSetting,
    Organization,
    Project,
    ProjectOwnership,
    Team,
    User,
    UserOption,
)
from sentry.notifications.helpers import (
    get_deploy_values_by_provider,
    get_settings_by_provider,
    transform_to_notification_settings_by_user,
)
from sentry.notifications.notify import notification_providers
from sentry.notifications.types import (
    ActionTargetType,
    GroupSubscriptionReason,
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.types.integrations import ExternalProviders
from sentry.utils import metrics
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


AVAILABLE_PROVIDERS = {
    ExternalProviders.EMAIL,
    ExternalProviders.SLACK,
}


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


def split_participants_and_context(
    participants_with_reasons: Mapping[User, int]
) -> Tuple[Set[User], Mapping[int, Mapping[str, Any]]]:
    participants = set()
    extra_context = {}
    for user, reason in participants_with_reasons.items():
        participants.add(user)
        extra_context[user.id] = {"reason": reason}
    return participants, extra_context


def get_send_to(
    project: Project,
    target_type: ActionTargetType,
    target_identifier: Optional[int] = None,
    event: Optional[Any] = None,
) -> Mapping[ExternalProviders, Union[Set[User], Set[Team]]]:
    """
    Returns a mapping of providers to a list of user IDs for the users that
    should receive notifications for the provided project. This result may come
    from cached data.
    """
    if not (project and project.teams.exists()):
        logger.debug("Tried to send notification to invalid project: %r", project)
        return {}
    if target_type == ActionTargetType.ISSUE_OWNERS:
        if not event:
            return get_send_to_all_in_project(project)
        else:
            return get_send_to_owners(event, project)
    elif target_type == ActionTargetType.MEMBER:
        return get_send_to_member(project, target_identifier)
    elif target_type == ActionTargetType.TEAM:
        return get_send_to_team(project, target_identifier)
    return {}


def get_send_to_owners(event: Any, project: Project) -> Mapping[ExternalProviders, Set[User]]:
    owners, _ = ProjectOwnership.get_owners(project.id, event.data)
    if owners == ProjectOwnership.Everyone:
        metrics.incr(
            "features.owners.send_to",
            tags={"organization": project.organization_id, "outcome": "everyone"},
            skip_internal=True,
        )
        return get_send_to_all_in_project(project)

    if not owners:
        metrics.incr(
            "features.owners.send_to",
            tags={"organization": project.organization_id, "outcome": "empty"},
            skip_internal=True,
        )
        return {}

    metrics.incr(
        "features.owners.send_to",
        tags={"organization": project.organization_id, "outcome": "match"},
        skip_internal=True,
    )
    user_ids_to_resolve = set()
    team_ids_to_resolve = set()
    for owner in owners:
        if owner.type == User:
            user_ids_to_resolve.add(owner.id)
        else:
            team_ids_to_resolve.add(owner.id)

    all_possible_users = set()

    if user_ids_to_resolve:
        all_possible_users |= set(User.objects.filter(id__in=user_ids_to_resolve))

    # Get all users in teams.
    if team_ids_to_resolve:
        all_possible_users |= get_users_for_teams_to_resolve(team_ids_to_resolve)

    mapping: Mapping[
        ExternalProviders, Set[User]
    ] = NotificationSetting.objects.filter_to_subscribed_users(project, all_possible_users)
    return mapping


def get_users_for_teams_to_resolve(teams_to_resolve: Set[int]) -> Set[User]:
    return set(
        User.objects.filter(
            is_active=True,
            sentry_orgmember_set__organizationmemberteam__team__id__in=teams_to_resolve,
        )
    )


def disabled_users_from_project(project: Project) -> Mapping[ExternalProviders, Set[User]]:
    """ Get a set of users that have disabled Issue Alert notifications for a given project. """
    user_ids = project.member_set.values_list("user", flat=True)
    users = User.objects.filter(id__in=user_ids)
    notification_settings = NotificationSetting.objects.get_for_users_by_parent(
        type=NotificationSettingTypes.ISSUE_ALERTS,
        parent=project,
        users=users,
    )
    notification_settings_by_user = transform_to_notification_settings_by_user(
        notification_settings, users
    )
    # Although this can be done with dict comprehension, looping for clarity.
    output = defaultdict(set)
    for user in users:
        settings = notification_settings_by_user.get(user)
        if settings:
            settings_by_provider = get_settings_by_provider(settings)
            for provider, settings_value_by_scope in settings_by_provider.items():
                project_setting = settings_value_by_scope.get(NotificationScopeType.PROJECT)
                user_setting = settings_value_by_scope.get(NotificationScopeType.USER)
                if project_setting == NotificationSettingOptionValues.NEVER or (
                    not project_setting and user_setting == NotificationSettingOptionValues.NEVER
                ):
                    output[provider].add(user)
    return output


def get_send_to_team(
    project: Project, target_identifier: Optional[Union[str, int]]
) -> Mapping[ExternalProviders, Set[User]]:
    """
    Get a team's notification settings. If not present, get settings for each subscribed user in the team.
    :param project:
    :param target_identifier: Optional. String or int representation of a team_id.
    :returns: Mapping[ExternalProvider, Iterable[User]] A mapping of provider to
        member that a notification should be sent to as a set.
    """
    if target_identifier is None:
        return {}
    try:
        team = Team.objects.get(id=int(target_identifier), projectteam__project=project)
    except Team.DoesNotExist:
        return {}

    team_notification_settings = NotificationSetting.objects.get_for_recipient_by_parent(
        NotificationSettingTypes.ISSUE_ALERTS, parent=project, recipient=team
    )

    if team_notification_settings:
        team_mapping = {
            ExternalProviders(notification_setting.provider): {team}
            for notification_setting in team_notification_settings
        }
        return team_mapping

    # fallback to notifying each subscribed user if there aren't team notification settings
    member_list = team.member_set.values_list("user_id", flat=True)
    users = User.objects.filter(id__in=member_list)

    mapping: Mapping[
        ExternalProviders, Set[User]
    ] = NotificationSetting.objects.filter_to_subscribed_users(project, users)
    return mapping


def get_send_to_member(
    project: Project, target_identifier: Optional[Union[int, str]]
) -> Mapping[ExternalProviders, Set[User]]:
    """
    No checking for disabled users is done. If a user explicitly specifies a
    member as a target to send to, it should overwrite the user's personal mail
    settings.
    :param project:
    :param target_identifier: Optional. String or int representation of a user_id.
    :returns: Mapping[ExternalProvider, Iterable[User]] A mapping of provider to
        member that a notification should be sent to as a set.
    """
    if target_identifier is None:
        return {}
    try:
        user = (
            User.objects.filter(
                id=int(target_identifier),
                sentry_orgmember_set__teams__projectteam__project=project,
            )
            .distinct()
            .get()
        )
    except User.DoesNotExist:
        return {}
    notification_settings = NotificationSetting.objects.get_for_users_by_parent(
        NotificationSettingTypes.ISSUE_ALERTS, parent=project, users=[user]
    )
    if notification_settings:
        return {
            ExternalProviders(notification_setting.provider): {user}
            for notification_setting in notification_settings
        }
    # Fall back to email if there are no settings.
    return {ExternalProviders.EMAIL: {user}}


def get_send_to_all_in_project(project: Project) -> Mapping[ExternalProviders, Set[User]]:
    cache_key = f"mail:send_to:{project.pk}"
    send_to_mapping: Optional[Mapping[ExternalProviders, Set[User]]] = cache.get(cache_key)
    if send_to_mapping is None:
        users_by_provider = NotificationSetting.objects.get_notification_recipients(project)
        send_to_mapping = {
            provider: {user for user in users if user}
            for provider, users in users_by_provider.items()
        }
        cache.set(cache_key, send_to_mapping, 60)  # 1 minute cache

    return send_to_mapping
