import logging
from collections import defaultdict
from typing import (
    TYPE_CHECKING,
    Any,
    Iterable,
    Mapping,
    MutableMapping,
    Optional,
    Set,
    Tuple,
    Union,
)

from sentry import features
from sentry.models import (
    ActorTuple,
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
    get_settings_by_provider,
    get_values_by_provider_by_type,
    transform_to_notification_settings_by_recipient,
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

if TYPE_CHECKING:
    from sentry.eventstore.models import Event

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
    users = set(User.objects.get_team_members_with_verified_email_for_projects(projects))

    # Get all the involved users' settings for deploy-emails (including
    # users' organization-independent settings.)
    notification_settings = NotificationSetting.objects.get_for_recipient_by_parent(
        NotificationSettingTypes.DEPLOY,
        recipients=users,
        parent=organization,
    )
    notification_settings_by_recipient = transform_to_notification_settings_by_recipient(
        notification_settings, users
    )

    should_use_slack_automatic = features.has(
        "organizations:notification-slack-automatic", organization
    )

    # Map users to their setting value. Prioritize user/org specific, then
    # user default, then product default.
    users_to_reasons_by_provider: MutableMapping[
        ExternalProviders, MutableMapping[User, int]
    ] = defaultdict(dict)
    for user in users:
        notification_settings_by_scope = notification_settings_by_recipient.get(user, {})
        values_by_provider = get_values_by_provider_by_type(
            notification_settings_by_scope,
            notification_providers(),
            NotificationSettingTypes.DEPLOY,
            should_use_slack_automatic=should_use_slack_automatic,
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


def get_owners(
    project: Project, event: Optional["Event"] = None
) -> Iterable[Union["Team", "User"]]:
    """Given a project and an event, decide which users and teams are the owners."""

    if event:
        owners, _ = ProjectOwnership.get_owners(project.id, event.data)
    else:
        owners = ProjectOwnership.Everyone

    if not owners:
        outcome = "empty"
        recipients = set()

    elif owners == ProjectOwnership.Everyone:
        outcome = "everyone"
        recipients = User.objects.filter(id__in=project.member_set.values_list("user", flat=True))

    else:
        outcome = "match"
        recipients = ActorTuple.resolve_many(owners)

    metrics.incr(
        "features.owners.send_to",
        tags={"organization": project.organization_id, "outcome": outcome},
        skip_internal=True,
    )
    return recipients


def disabled_users_from_project(project: Project) -> Mapping[ExternalProviders, Set[User]]:
    """Get a set of users that have disabled Issue Alert notifications for a given project."""
    user_ids = project.member_set.values_list("user", flat=True)
    users = User.objects.filter(id__in=user_ids)
    notification_settings = NotificationSetting.objects.get_for_recipient_by_parent(
        type=NotificationSettingTypes.ISSUE_ALERTS,
        parent=project,
        recipients=users,
    )
    notification_settings_by_recipient = transform_to_notification_settings_by_recipient(
        notification_settings, users
    )
    # Although this can be done with dict comprehension, looping for clarity.
    output = defaultdict(set)
    for user in users:
        settings = notification_settings_by_recipient.get(user)
        if settings:
            settings_by_provider = get_settings_by_provider(settings)
            for provider, settings_value_by_scope in settings_by_provider.items():
                project_setting = settings_value_by_scope.get(NotificationScopeType.PROJECT)
                user_setting = settings_value_by_scope.get(
                    NotificationScopeType.USER
                ) or settings_value_by_scope.get(NotificationScopeType.TEAM)
                if project_setting == NotificationSettingOptionValues.NEVER or (
                    not project_setting and user_setting == NotificationSettingOptionValues.NEVER
                ):
                    output[provider].add(user)
    return output


def determine_eligible_recipients(
    project: "Project",
    target_type: ActionTargetType,
    target_identifier: Optional[int] = None,
    event: Optional["Event"] = None,
) -> Iterable[Union["Team", "User"]]:
    """
    Either get the individual recipient from the target type/id or user the the
    owners as determined by rules for this project and event.
    """
    if not (project and project.teams.exists()):
        logger.debug(f"Tried to send notification to invalid project: {project}")

    elif target_type == ActionTargetType.MEMBER:
        user = get_user_from_identifier(project, target_identifier)
        if user:
            return {user}

    elif target_type == ActionTargetType.TEAM:
        team = get_team_from_identifier(project, target_identifier)
        if team:
            return {team}

    else:
        return get_owners(project, event)

    return set()


def get_send_to(
    project: "Project",
    target_type: ActionTargetType,
    target_identifier: Optional[int] = None,
    event: Optional["Event"] = None,
) -> Mapping[ExternalProviders, Iterable[Union["Team", "User"]]]:
    recipients = determine_eligible_recipients(project, target_type, target_identifier, event)
    return get_recipients_by_provider(project, recipients)


def get_user_from_identifier(
    project: "Project", target_identifier: Optional[Union[str, int]]
) -> Optional["User"]:
    if target_identifier is None:
        return None

    try:
        return (
            User.objects.filter(
                id=int(target_identifier),
                sentry_orgmember_set__teams__projectteam__project=project,
            )
            .distinct()
            .get()
        )
    except User.DoesNotExist:
        return None


def get_team_from_identifier(
    project: "Project", target_identifier: Optional[Union[str, int]]
) -> Optional["Team"]:
    if target_identifier is None:
        return None

    try:
        return Team.objects.get(id=int(target_identifier), projectteam__project=project)
    except Team.DoesNotExist:
        return None


def partition_recipients(
    recipients: Iterable[Union["Team", "User"]]
) -> Tuple[Iterable["Team"], Iterable["User"]]:
    teams, users = set(), set()
    for recipient in recipients:
        if isinstance(recipient, User):
            users.add(recipient)
        else:
            teams.add(recipient)
    return teams, users


def get_users_from_team_fall_back(
    teams: Iterable["Team"],
    recipients_by_provider: Mapping[ExternalProviders, Iterable[Union["Team", "User"]]],
) -> Iterable["User"]:
    teams_to_fall_back = set(teams)
    for recipients in recipients_by_provider.values():
        for recipient in recipients:
            teams_to_fall_back.remove(recipient)

    users = set()
    for team in teams_to_fall_back:
        # Fall back to notifying each subscribed user if there aren't team notification settings
        member_list = team.member_set.values_list("user_id", flat=True)
        users |= set(User.objects.filter(id__in=member_list))
    return users


def combine_recipients_by_provider(
    teams_by_provider: Mapping[ExternalProviders, Iterable[Union["Team", "User"]]],
    users_by_provider: Mapping[ExternalProviders, Iterable[Union["Team", "User"]]],
) -> Mapping[ExternalProviders, Iterable[Union["Team", "User"]]]:
    """TODO(mgaeta): Make this more generic and move it to utils."""
    recipients_by_provider = defaultdict(set)
    for provider, teams in teams_by_provider.items():
        for team in teams:
            recipients_by_provider[provider].add(team)
    for provider, users in users_by_provider.items():
        for user in users:
            recipients_by_provider[provider].add(user)
    return recipients_by_provider


def get_recipients_by_provider(
    project: Project, recipients: Iterable[Union["Team", "User"]]
) -> Mapping[ExternalProviders, Iterable[Union["Team", "User"]]]:
    """Get the lists of recipients that should receive an Issue Alert by ExternalProvider."""
    teams, users = partition_recipients(recipients)

    # First evaluate the teams.
    teams_by_provider = NotificationSetting.objects.filter_to_accepting_recipients(project, teams)

    # Teams cannot receive emails so omit EMAIL settings.
    teams_by_provider = {
        provider: teams
        for provider, teams in teams_by_provider.items()
        if provider != ExternalProviders.EMAIL
    }

    # If there are any teams that didn't get added, fall back and add all users.
    users = set(users).union(get_users_from_team_fall_back(teams, teams_by_provider))

    # Repeat for users.
    users_by_provider = NotificationSetting.objects.filter_to_accepting_recipients(project, users)

    return combine_recipients_by_provider(teams_by_provider, users_by_provider)
