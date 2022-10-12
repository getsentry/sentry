from __future__ import annotations

import logging
from collections import defaultdict
from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping, Sequence

from sentry import features
from sentry.models import (
    ActorTuple,
    Commit,
    Group,
    GroupSubscription,
    NotificationSetting,
    Organization,
    Project,
    ProjectOwnership,
    Release,
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
) -> set[ExternalProviders]:
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
    group: Group, user: User | None = None
) -> Mapping[ExternalProviders, Mapping[Team | User, int]]:
    participants_by_provider: MutableMapping[
        ExternalProviders, MutableMapping[Team | User, int]
    ] = GroupSubscription.objects.get_participants(group)
    if user:
        # Optionally remove the actor that created the activity from the recipients list.
        providers = get_providers_from_which_to_remove_user(user, participants_by_provider)
        for provider in providers:
            del participants_by_provider[provider][user]

    return participants_by_provider


def get_reason(
    user: User, value: NotificationSettingOptionValues, user_ids: set[int]
) -> int | None:
    # Members who opt into all deploy emails.
    if value == NotificationSettingOptionValues.ALWAYS:
        return GroupSubscriptionReason.deploy_setting

    # Members which have been seen in the commit log.
    elif value == NotificationSettingOptionValues.COMMITTED_ONLY and user.id in user_ids:
        return GroupSubscriptionReason.committed
    return None


def get_participants_for_release(
    projects: Iterable[Project], organization: Organization, user_ids: set[int]
) -> Mapping[ExternalProviders, Mapping[Team | User, int]]:
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

    # Map users to their setting value. Prioritize user/org specific, then
    # user default, then product default.
    users_to_reasons_by_provider: MutableMapping[
        ExternalProviders, MutableMapping[Team | User, int]
    ] = defaultdict(dict)
    for user in users:
        notification_settings_by_scope = notification_settings_by_recipient.get(user, {})
        values_by_provider = get_values_by_provider_by_type(
            notification_settings_by_scope,
            notification_providers(),
            NotificationSettingTypes.DEPLOY,
            user,
        )
        for provider, value in values_by_provider.items():
            reason_option = get_reason(user, value, user_ids)
            if reason_option:
                users_to_reasons_by_provider[provider][user] = reason_option
    return users_to_reasons_by_provider


def split_participants_and_context(
    participants_with_reasons: Mapping[Team | User, int]
) -> tuple[Iterable[Team | User], Mapping[int, Mapping[str, Any]]]:
    return participants_with_reasons.keys(), {
        participant.actor_id: {"reason": reason}
        for participant, reason in participants_with_reasons.items()
    }


def get_owners(project: Project, event: Event | None = None) -> Sequence[Team | User]:
    """
    Given a project and an event, decide which users and teams are the owners.

    If when checking owners, there is a rule match we only notify the last owner
    (would-be auto-assignee) unless the organization passes the feature-flag
    """

    if event:
        owners, _ = ProjectOwnership.get_owners(project.id, event.data)
    else:
        owners = ProjectOwnership.Everyone

    if not owners:
        outcome = "empty"
        recipients = list()

    elif owners == ProjectOwnership.Everyone:
        outcome = "everyone"
        recipients = User.objects.filter(id__in=project.member_set.values_list("user", flat=True))

    else:
        outcome = "match"
        recipients = ActorTuple.resolve_many(owners)
        # Used to suppress extra notifications to all matched owners, only notify the would-be auto-assignee
        if not features.has("organizations:notification-all-recipients", project.organization):
            recipients = recipients[-1:]

    metrics.incr(
        "features.owners.send_to",
        tags={"organization": project.organization_id, "outcome": outcome},
        skip_internal=True,
    )
    return recipients


def disabled_users_from_project(project: Project) -> Mapping[ExternalProviders, set[User]]:
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
    project: Project,
    target_type: ActionTargetType,
    target_identifier: int | None = None,
    event: Event | None = None,
) -> Iterable[Team | User]:
    """
    Either get the individual recipient from the target type/id or the
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

    elif target_type == ActionTargetType.RELEASE_MEMBERS:
        return get_release_committers(project, event)

    else:
        return get_owners(project, event)

    return set()


def get_release_committers(project: Project, event: Event) -> Sequence[User]:
    # get_participants_for_release seems to be the method called when deployments happen
    # supposedly, this logic should be fairly, close ...
    # why is get_participants_for_release so much more complex???
    if not project or not event:
        return []

    if not event.group:
        return []

    last_release_version: str | None = event.group.get_last_release()
    if not last_release_version:
        return []

    last_release: Release = Release.get(project, last_release_version)
    if not last_release:
        return []

    return _get_release_committers(last_release)


def _get_release_committers(release: Release) -> Sequence[User]:
    from sentry.api.serializers import Author, get_users_for_commits
    from sentry.utils.committers import _get_commits

    commits: Sequence[Commit] = _get_commits([release])
    if not commits:
        return []

    # commit_author_id : Author
    author_users: Mapping[str, Author] = get_users_for_commits(commits)

    release_committers = list(
        User.objects.filter(id__in={au["id"] for au in author_users.values() if au.get("id")})
    )

    if features.has("organizations:active-release-notifications-enable", release.organization):
        return release_committers
    return []


def get_send_to(
    project: Project,
    target_type: ActionTargetType,
    target_identifier: int | None = None,
    event: Event | None = None,
    notification_type: NotificationSettingTypes = NotificationSettingTypes.ISSUE_ALERTS,
) -> Mapping[ExternalProviders, set[Team | User]]:
    recipients = determine_eligible_recipients(project, target_type, target_identifier, event)
    return get_recipients_by_provider(project, recipients, notification_type)


def get_user_from_identifier(project: Project, target_identifier: str | int | None) -> User | None:
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


def get_team_from_identifier(project: Project, target_identifier: str | int | None) -> Team | None:
    if target_identifier is None:
        return None

    try:
        return Team.objects.get(id=int(target_identifier), projectteam__project=project)
    except Team.DoesNotExist:
        return None


def partition_recipients(
    recipients: Iterable[Team | User],
) -> tuple[Iterable[Team], Iterable[User]]:
    teams, users = set(), set()
    for recipient in recipients:
        if isinstance(recipient, User):
            users.add(recipient)
        else:
            teams.add(recipient)
    return teams, users


def get_users_from_team_fall_back(
    teams: Iterable[Team],
    recipients_by_provider: Mapping[ExternalProviders, Iterable[Team | User]],
) -> Iterable[User]:
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
    teams_by_provider: Mapping[ExternalProviders, set[Team | User]],
    users_by_provider: Mapping[ExternalProviders, set[Team | User]],
) -> Mapping[ExternalProviders, set[Team | User]]:
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
    project: Project,
    recipients: Iterable[Team | User],
    notification_type: NotificationSettingTypes = NotificationSettingTypes.ISSUE_ALERTS,
) -> Mapping[ExternalProviders, set[Team | User]]:
    """Get the lists of recipients that should receive an Issue Alert by ExternalProvider."""
    teams, users = partition_recipients(recipients)

    # First evaluate the teams.
    teams_by_provider = NotificationSetting.objects.filter_to_accepting_recipients(
        project, teams, notification_type
    )

    # Teams cannot receive emails so omit EMAIL settings.
    teams_by_provider = {
        provider: teams
        for provider, teams in teams_by_provider.items()
        if provider != ExternalProviders.EMAIL
    }

    # If there are any teams that didn't get added, fall back and add all users.
    users = set(users).union(get_users_from_team_fall_back(teams, teams_by_provider))

    # Repeat for users.
    users_by_provider = NotificationSetting.objects.filter_to_accepting_recipients(
        project, users, notification_type
    )

    return combine_recipients_by_provider(teams_by_provider, users_by_provider)
