from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.db.models import Q
from django.utils import timezone
from typing import Mapping

from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)


class GroupSubscriptionReason:
    implicit = -1  # not for use as a persisted field value
    committed = -2  # not for use as a persisted field value
    processing_issue = -3  # not for use as a persisted field value

    unknown = 0
    comment = 1
    assigned = 2
    bookmark = 3
    status_change = 4
    deploy_setting = 5
    mentioned = 6
    team_mentioned = 7

    descriptions = {
        implicit: "have opted to receive updates for all issues within "
        "projects that you are a member of",
        committed: "were involved in a commit that is part of this release",
        processing_issue: "are subscribed to alerts for this project",
        comment: "have commented on this issue",
        assigned: "have been assigned to this issue",
        bookmark: "have bookmarked this issue",
        status_change: "have changed the resolution status of this issue",
        deploy_setting: "opted to receive all deploy notifications for this organization",
        mentioned: "have been mentioned in this issue",
        team_mentioned: "are a member of a team mentioned in this issue",
    }


def get_user_options(key, user_ids, project, default):
    from sentry.models import UserOption

    options = {
        (option.user_id, option.project_id): option.value
        for option in UserOption.objects.filter(
            Q(project__isnull=True) | Q(project=project),
            user_id__in=user_ids,
            key=key,
        )
    }

    return {
        user_id: options.get((user_id, project.id), options.get((user_id, None), default))
        for user_id in user_ids
    }


class GroupSubscriptionManager(BaseManager):
    def subscribe(self, group, user, reason=GroupSubscriptionReason.unknown):
        """
        Subscribe a user to an issue, but only if the user has not explicitly
        unsubscribed.
        """
        try:
            with transaction.atomic():
                self.create(
                    user=user, group=group, project=group.project, is_active=True, reason=reason
                )
        except IntegrityError:
            pass

    def subscribe_actor(self, group, actor, reason=GroupSubscriptionReason.unknown):
        from sentry.models import User, Team

        if isinstance(actor, User):
            return self.subscribe(group, actor, reason)
        if isinstance(actor, Team):
            # subscribe the members of the team
            team_users_ids = list(actor.member_set.values_list("user_id", flat=True))
            return self.bulk_subscribe(group, team_users_ids, reason)

        raise NotImplementedError("Unknown actor type: %r" % type(actor))

    def bulk_subscribe(self, group, user_ids, reason=GroupSubscriptionReason.unknown):
        """
        Subscribe a list of user ids to an issue, but only if the users are not explicitly
        unsubscribed.
        """
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

    @staticmethod
    def get_participants(group) -> Mapping[any, GroupSubscriptionReason]:
        """
        Identify all users who are participating with a given issue.
        :param group: Group object
        :returns Map of User objects to GroupSubscriptionReason
        """
        from sentry.models import User
        from sentry.notifications.legacy_mappings import UserOptionValue

        users = {
            user.id: user
            for user in User.objects.filter(
                sentry_orgmember_set__teams__in=group.project.teams.all(), is_active=True
            )
        }

        subscriptions = {
            subscription.user_id: subscription
            for subscription in GroupSubscription.objects.filter(
                group=group, user_id__in=users.keys()
            )
        }

        options = get_user_options(
            "workflow:notifications",
            list(users.keys()),
            group.project,
            UserOptionValue.participating_only,
        )

        excluded_ids = {
            user_id for user_id, subscription in subscriptions.items() if not subscription.is_active
        }

        for user_id, option in options.items():
            if option == UserOptionValue.no_conversations:
                excluded_ids.add(user_id)
            elif option == UserOptionValue.participating_only:
                if user_id not in subscriptions:
                    excluded_ids.add(user_id)

        return {
            user: getattr(subscriptions.get(user_id), "reason", GroupSubscriptionReason.implicit)
            for user_id, user in users.items()
            if user_id not in excluded_ids
        }


class GroupSubscription(Model):
    """
    Identifies a subscription relationship between a user and an issue.
    """

    __core__ = False

    project = FlexibleForeignKey("sentry.Project", related_name="subscription_set")
    group = FlexibleForeignKey("sentry.Group", related_name="subscription_set")
    # namespace related_name on User since we don't own the model
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    is_active = models.BooleanField(default=True)
    reason = BoundedPositiveIntegerField(default=GroupSubscriptionReason.unknown)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    objects = GroupSubscriptionManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupsubscription"
        unique_together = (("group", "user"),)

    __repr__ = sane_repr("project_id", "group_id", "user_id")
