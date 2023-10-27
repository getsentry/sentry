from __future__ import annotations

from typing import TYPE_CHECKING, Iterable, Optional, Sequence, Union

from django.conf import settings
from django.db import IntegrityError, models, router, transaction
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.notifications.helpers import (
    should_use_notifications_v2,
    transform_to_notification_settings_by_recipient,
    where_should_be_participating,
)
from sentry.notifications.types import (
    GroupSubscriptionReason,
    NotificationSettingEnum,
    NotificationSettingsOptionEnum,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.notifications import notifications_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models.group import Group
    from sentry.models.team import Team
    from sentry.models.user import User
    from sentry.notifications.utils.participants import ParticipantMap


class GroupSubscriptionManager(BaseManager):
    def subscribe(
        self,
        group: Group,
        subscriber: User | RpcUser | Team,
        reason: int = GroupSubscriptionReason.unknown,
    ) -> bool:
        """
        Subscribe a user or team to an issue, but only if that user or team has not explicitly
        unsubscribed.
        """
        from sentry.models.team import Team
        from sentry.models.user import User

        try:
            with transaction.atomic(router.db_for_write(GroupSubscription)):
                if isinstance(subscriber, (User, RpcUser)):
                    self.create(
                        user_id=subscriber.id,
                        group=group,
                        project=group.project,
                        is_active=True,
                        reason=reason,
                    )
                elif isinstance(subscriber, Team):
                    self.create(
                        team=subscriber,
                        group=group,
                        project=group.project,
                        is_active=True,
                        reason=reason,
                    )
        except IntegrityError:
            pass
        return True

    def subscribe_actor(
        self,
        group: Group,
        actor: Union[Team, User, RpcUser],
        reason: int = GroupSubscriptionReason.unknown,
    ) -> Optional[bool]:
        from sentry import features
        from sentry.models.team import Team
        from sentry.models.user import User

        if isinstance(actor, (RpcUser, User)):
            return self.subscribe(group, actor, reason)
        if isinstance(actor, Team):
            if features.has("organizations:team-workflow-notifications", group.organization):
                return self.subscribe(group, actor, reason)
            else:
                # subscribe the members of the team
                team_users_ids = list(actor.member_set.values_list("user_id", flat=True))
                return self.bulk_subscribe(group=group, user_ids=team_users_ids, reason=reason)

        raise NotImplementedError("Unknown actor type: %r" % type(actor))

    def bulk_subscribe(
        self,
        group: Group,
        user_ids: Iterable[int] | None = None,
        team_ids: Iterable[int] | None = None,
        reason: int = GroupSubscriptionReason.unknown,
    ) -> bool:
        """
        Subscribe a list of user ids and/or teams to an issue, but only if the users/teams are not explicitly
        unsubscribed.
        """
        from sentry import features

        # Unique the IDs.
        user_ids = set(user_ids) if user_ids else set()

        # Unique the teams.
        team_ids = set(team_ids) if team_ids else set()

        # 5 retries for race conditions where
        # concurrent subscription attempts cause integrity errors
        for i in range(4, -1, -1):  # 4 3 2 1 0

            existing_subscriptions = set(
                GroupSubscription.objects.filter(
                    user_id__in=user_ids, group=group, project=group.project
                ).values_list("user_id", flat=True)
            )

            subscriptions = [
                GroupSubscription(
                    user_id=user_id,
                    group=group,
                    project=group.project,
                    is_active=True,
                    reason=reason,
                )
                for user_id in user_ids.difference(existing_subscriptions)
            ]

            if features.has("organizations:team-workflow-notifications", group.organization):
                existing_team_subscriptions = set(
                    GroupSubscription.objects.filter(
                        team_id__in=team_ids, group=group, project=group.project
                    ).values_list("team_id", flat=True)
                )

                subscriptions.extend(
                    [
                        GroupSubscription(
                            team_id=team_id,
                            group=group,
                            project=group.project,
                            is_active=True,
                            reason=reason,
                        )
                        for team_id in team_ids.difference(existing_team_subscriptions)
                    ]
                )

            try:
                with transaction.atomic(router.db_for_write(GroupSubscription)):
                    self.bulk_create(subscriptions)
                    return True
            except IntegrityError as e:
                if i == 0:
                    raise e
        return False

    def get_participants(self, group: Group) -> ParticipantMap:
        """
        Identify all users who are participating with a given issue.
        :param group: Group object
        """
        from sentry import features
        from sentry.models.team import Team
        from sentry.notifications.utils.participants import ParticipantMap

        all_possible_users = RpcActor.many_from_object(group.project.get_members_as_rpc_users())
        active_and_disabled_subscriptions = self.filter(
            group=group, user_id__in=[u.id for u in all_possible_users]
        )
        subscriptions_by_user_id = {
            subscription.user_id: subscription for subscription in active_and_disabled_subscriptions
        }

        has_team_workflow = features.has(
            "organizations:team-workflow-notifications", group.project.organization
        )
        if should_use_notifications_v2(group.project.organization) and has_team_workflow:
            possible_teams_ids = Team.objects.filter(id__in=self.get_participating_team_ids(group))
            possible_teams_actors = RpcActor.many_from_object(possible_teams_ids)
            all_possible_users += possible_teams_actors
            active_and_disabled_team_subscriptions = self.filter(
                group=group, team_id__in=[t.id for t in all_possible_users]
            )
            subscriptions_by_team_id = {
                subscription.team_id: subscription
                for subscription in active_and_disabled_team_subscriptions
            }

        if should_use_notifications_v2(group.project.organization):
            if not all_possible_users:  # no users, no notifications
                return ParticipantMap()

            providers_by_recipient = notifications_service.get_participants(
                recipients=all_possible_users,
                project_ids=[group.project_id],
                organization_id=group.organization.id,
                type=NotificationSettingEnum.WORKFLOW,
            )
            result = ParticipantMap()
            for user in all_possible_users:
                if user.id not in providers_by_recipient:
                    continue

                subscription_option = subscriptions_by_user_id.get(user.id, {})
                if not subscription_option and has_team_workflow:
                    subscription_option = subscriptions_by_team_id.get(user.id, {})

                for provider_str, val in providers_by_recipient[user.id].items():
                    value = NotificationSettingsOptionEnum(val)
                    is_subcribed = (
                        subscription_option
                        and subscription_option.is_active
                        and value
                        in [
                            NotificationSettingsOptionEnum.ALWAYS,
                            NotificationSettingsOptionEnum.SUBSCRIBE_ONLY,
                        ]
                    )
                    is_implicit = (
                        not subscription_option and value == NotificationSettingsOptionEnum.ALWAYS
                    )
                    if is_subcribed or is_implicit:
                        reason = (
                            subscription_option
                            and subscription_option.reason
                            or GroupSubscriptionReason.implicit
                        )
                        provider = ExternalProviders(provider_str)
                        result.add(provider, user, reason)
            return result

        notification_settings = notifications_service.get_settings_for_recipient_by_parent(
            type=NotificationSettingTypes.WORKFLOW,
            recipients=all_possible_users,
            parent_id=group.project_id,
        )
        notification_settings_by_recipient = transform_to_notification_settings_by_recipient(
            notification_settings, all_possible_users
        )

        result = ParticipantMap()
        for user in all_possible_users:
            subscription_option = subscriptions_by_user_id.get(user.id)
            providers = where_should_be_participating(
                user,
                subscription_option,
                notification_settings_by_recipient,
            )
            for provider in providers:
                reason = (
                    subscription_option
                    and subscription_option.reason
                    or GroupSubscriptionReason.implicit
                )
                result.add(provider, user, reason)

        return result

    @staticmethod
    def get_participating_user_ids(group: Group) -> Sequence[int]:
        """Return the list of user ids participating in this issue."""

        return list(
            GroupSubscription.objects.filter(group=group, is_active=True, team=None).values_list(
                "user_id", flat=True
            )
        )

    @staticmethod
    def get_participating_team_ids(group: Group) -> Sequence[int]:
        """Return the list of team ids participating in this issue."""

        return list(
            GroupSubscription.objects.filter(group=group, is_active=True, user_id=None).values_list(
                "team_id", flat=True
            )
        )


@region_silo_only_model
class GroupSubscription(Model):
    """
    Identifies a subscription relationship between a user and an issue.
    """

    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project", related_name="subscription_set")
    group = FlexibleForeignKey("sentry.Group", related_name="subscription_set")
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="CASCADE")
    team = FlexibleForeignKey("sentry.Team", null=True, db_index=True, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    reason = BoundedPositiveIntegerField(default=GroupSubscriptionReason.unknown)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    objects = GroupSubscriptionManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupsubscription"
        unique_together = (("group", "user_id"), ("group", "team"))
        constraints = [
            models.CheckConstraint(
                check=models.Q(team_id__isnull=False, user_id__isnull=True)
                | models.Q(team_id__isnull=True, user_id__isnull=False),
                name="subscription_team_or_user_check",
            )
        ]

    __repr__ = sane_repr("project_id", "group_id", "user_id")
