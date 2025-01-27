from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Iterable, Mapping, MutableMapping
from typing import TYPE_CHECKING, Any, TypedDict, TypeGuard

from django.db.models import Subquery

from sentry.hybridcloud.models.externalactorreplica import ExternalActorReplica
from sentry.integrations.types import ExternalProviderEnum
from sentry.integrations.utils.providers import PERSONAL_NOTIFICATION_PROVIDERS_AS_INT
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.organizationmemberteamreplica import OrganizationMemberTeamReplica
from sentry.notifications.defaults import (
    DEFAULT_ENABLED_PROVIDERS_VALUES,
    NOTIFICATION_SETTINGS_TYPE_DEFAULTS,
)
from sentry.notifications.types import (
    SUBSCRIPTION_REASON_MAP,
    VALID_VALUES_FOR_KEY,
    GroupSubscriptionReason,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
)
from sentry.types.actor import Actor, ActorType
from sentry.users.services.user.model import RpcUser

if TYPE_CHECKING:
    from sentry.models.group import Group
    from sentry.models.team import Team
    from sentry.users.models.user import User

logger = logging.getLogger(__name__)


def get_default_for_provider(
    type: NotificationSettingEnum,
    provider: ExternalProviderEnum,
) -> NotificationSettingsOptionEnum:
    # check if the provider is enable in our defaults and that the type exists as an enum
    if (
        provider.value not in DEFAULT_ENABLED_PROVIDERS_VALUES
        or type not in NotificationSettingEnum
    ):
        return NotificationSettingsOptionEnum.NEVER

    # TODO(Steve): Make sure that all keys are present in NOTIFICATION_SETTINGS_TYPE_DEFAULTS
    if type not in NOTIFICATION_SETTINGS_TYPE_DEFAULTS:
        return NotificationSettingsOptionEnum.NEVER

    # special case to disable reports for non-email providers
    if (
        type == NotificationSettingEnum.REPORTS
        and provider.value != ExternalProviderEnum.EMAIL.value
    ):
        # Reports are only sent to email
        return NotificationSettingsOptionEnum.NEVER

    return NOTIFICATION_SETTINGS_TYPE_DEFAULTS[type]


def get_type_defaults() -> Mapping[NotificationSettingEnum, NotificationSettingsOptionEnum]:
    # this tells us what the default value is for each notification type
    type_defaults = {}
    for notification_type, default in NOTIFICATION_SETTINGS_TYPE_DEFAULTS.items():
        # for the given notification type, figure out what the default value is
        type_defaults[notification_type] = default
    return type_defaults


def validate(type: NotificationSettingEnum, value: NotificationSettingsOptionEnum) -> bool:
    """:returns boolean. True if the "value" is valid for the "type"."""
    return value in VALID_VALUES_FOR_KEY.get(type, {})


class SubscriptionDetails(TypedDict, total=False):
    disabled: bool
    reason: str


def get_subscription_from_attributes(
    attrs: Mapping[str, Any]
) -> tuple[bool, SubscriptionDetails | None]:
    subscription_details: SubscriptionDetails | None = None
    is_disabled, is_subscribed, subscription = attrs["subscription"]
    if is_disabled:
        subscription_details = {"disabled": True}
    elif subscription and subscription.is_active:
        subscription_details = {
            "reason": SUBSCRIPTION_REASON_MAP.get(subscription.reason, "unknown")
        }

    return is_subscribed, subscription_details


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


def get_reason_context(extra_context: Mapping[str, Any]) -> MutableMapping[str, str]:
    """Get user-specific context. Do not call get_context() here."""
    reason = extra_context.get("reason", 0)
    return {
        "reason": GroupSubscriptionReason.descriptions.get(reason, "are subscribed to this issue")
    }


def recipient_is_user(
    recipient: Actor | Team | RpcUser | User,
) -> TypeGuard[Actor | RpcUser | User]:
    from sentry.users.models.user import User

    if isinstance(recipient, Actor) and recipient.is_user:
        return True
    return isinstance(recipient, (RpcUser, User))


def recipient_is_team(recipient: Actor | Team | RpcUser | User) -> TypeGuard[Actor | Team]:
    from sentry.models.team import Team

    if isinstance(recipient, Actor) and recipient.is_team:
        return True
    return isinstance(recipient, Team)


def team_is_valid_recipient(team: Team | Actor) -> bool:
    """
    A team is a valid recipient if it has a linked integration (ie. linked Slack channel)
    for any one of the providers allowed for personal notifications.
    """

    linked_integration = ExternalActorReplica.objects.filter(
        team_id=team.id,
        provider__in=PERSONAL_NOTIFICATION_PROVIDERS_AS_INT,
    )
    if linked_integration:
        return True
    return False


def get_team_members(team: Team | Actor) -> list[Actor]:
    if recipient_is_team(team):  # handles type error below
        team_id = team.id
    else:  # team is either Team or Actor, so if recipient_is_team returns false it is because Actor has a different type
        raise Exception(
            "Actor team has ActorType %s, expected ActorType Team", team.actor_type  # type: ignore[union-attr]
        )

    # get organization member IDs of all members in the team
    team_members = OrganizationMemberTeamReplica.objects.filter(team_id=team_id)

    # use the first member to get the org id + determine if there are any members to begin with
    first_member = team_members.first()
    if not first_member:
        return []
    org_id = first_member.organization_id

    # get user IDs for all members in the team
    members = OrganizationMemberMapping.objects.filter(
        organization_id=org_id,
        organizationmember_id__in=Subquery(team_members.values("organizationmember_id")),
    )

    return [
        Actor(id=user_id, actor_type=ActorType.USER)
        for user_id in members.values_list("user_id", flat=True)
        if user_id
    ]
