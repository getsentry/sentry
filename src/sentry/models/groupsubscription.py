from typing import TYPE_CHECKING, Iterable, Optional, Sequence, Union

from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.utils import timezone

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
    transform_to_notification_settings_by_recipient,
    where_should_be_participating,
)
from sentry.notifications.types import GroupSubscriptionReason, NotificationSettingTypes
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.services.hybrid_cloud.notifications import notifications_service
from sentry.services.hybrid_cloud.user import RpcUser

if TYPE_CHECKING:
    from sentry.models import Group, Team, User
    from sentry.notifications.utils.participants import ParticipantMap


class GroupSubscriptionManager(BaseManager):  # type: ignore
    def subscribe(
        self,
        group: "Group",
        user: "RpcUser",
        reason: int = GroupSubscriptionReason.unknown,
    ) -> bool:
        """
        Subscribe a user to an issue, but only if the user has not explicitly
        unsubscribed.
        """
        try:
            with transaction.atomic():
                self.create(
                    user_id=user.id,
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
        group: "Group",
        actor: Union["Team", "User", "RpcUser"],
        reason: int = GroupSubscriptionReason.unknown,
    ) -> Optional[bool]:
        from sentry.models import Team, User

        if isinstance(actor, RpcUser) or isinstance(actor, User):
            return self.subscribe(group, actor, reason)
        if isinstance(actor, Team):
            # subscribe the members of the team
            team_users_ids = list(actor.member_set.values_list("user_id", flat=True))
            return self.bulk_subscribe(group, team_users_ids, reason)

        raise NotImplementedError("Unknown actor type: %r" % type(actor))

    def bulk_subscribe(
        self,
        group: "Group",
        user_ids: Iterable[int],
        reason: int = GroupSubscriptionReason.unknown,
    ) -> bool:
        """
        Subscribe a list of user ids to an issue, but only if the users are not explicitly
        unsubscribed.
        """
        # Unique the IDs.
        user_ids = set(user_ids)

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
                for user_id in user_ids
                if user_id not in existing_subscriptions
            ]

            try:
                with transaction.atomic():
                    self.bulk_create(subscriptions)
                    return True
            except IntegrityError as e:
                if i == 0:
                    raise e
        return False

    def get_participants(self, group: "Group") -> "ParticipantMap":
        """
        Identify all users who are participating with a given issue.
        :param group: Group object
        """
        from sentry.notifications.utils.participants import ParticipantMap

        all_possible_users = RpcActor.many_from_object(group.project.get_members_as_rpc_users())
        active_and_disabled_subscriptions = self.filter(
            group=group, user_id__in=[u.id for u in all_possible_users]
        )

        notification_settings = notifications_service.get_settings_for_recipient_by_parent(
            type=NotificationSettingTypes.WORKFLOW,
            recipients=all_possible_users,
            parent_id=group.project_id,
        )
        subscriptions_by_user_id = {
            subscription.user_id: subscription for subscription in active_and_disabled_subscriptions
        }
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
    def get_participating_user_ids(group: "Group") -> Sequence[int]:
        """Return the list of user ids participating in this issue."""

        return list(
            GroupSubscription.objects.filter(group=group, is_active=True).values_list(
                "user_id", flat=True
            )
        )


@region_silo_only_model
class GroupSubscription(Model):  # type: ignore
    """
    Identifies a subscription relationship between a user and an issue.
    """

    __include_in_export__ = False

    project = FlexibleForeignKey("sentry.Project", related_name="subscription_set")
    group = FlexibleForeignKey("sentry.Group", related_name="subscription_set")
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, on_delete="CASCADE")
    is_active = models.BooleanField(default=True)
    reason = BoundedPositiveIntegerField(default=GroupSubscriptionReason.unknown)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    objects = GroupSubscriptionManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupsubscription"
        unique_together = (("group", "user_id"),)

    __repr__ = sane_repr("project_id", "group_id", "user_id")
