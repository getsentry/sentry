from __future__ import absolute_import

from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.db.models import Q
from django.utils import timezone

from sentry.db.models import (
    BaseManager, BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
)


class GroupSubscriptionReason(object):
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

    descriptions = {
        implicit:
        u"have opted to receive updates for all issues within "
        "projects that you are a member of",
        committed:
        u"were involved in a commit that is part of this release",
        processing_issue:
        u"are subscribed to alerts for this project",
        comment:
        u"have commented on this issue",
        assigned:
        u"have been assigned to this issue",
        bookmark:
        u"have bookmarked this issue",
        status_change:
        u"have changed the resolution status of this issue",
        deploy_setting:
        u"opted to receive all deploy notifications for this organization",
        mentioned:
        u"have been mentioned in this issue",
    }


def get_user_options(key, user_ids, project, default):
    from sentry.models import UserOption

    options = {
        (option.user_id, option.project_id): option.value
        for option in
        UserOption.objects.filter(
            Q(project__isnull=True) | Q(project=project),
            user_id__in=user_ids,
            key='workflow:notifications',
        )
    }

    results = {}

    for user_id in user_ids:
        results[user_id] = options.get(
            (user_id, project.id),
            options.get(
                (user_id, None),
                default,
            ),
        )

    return results


class GroupSubscriptionManager(BaseManager):
    def subscribe(self, group, user, reason=GroupSubscriptionReason.unknown):
        """
        Subscribe a user to an issue, but only if the user has not explicitly
        unsubscribed.
        """
        try:
            with transaction.atomic():
                self.create(
                    user=user,
                    group=group,
                    project=group.project,
                    is_active=True,
                    reason=reason,
                )
        except IntegrityError:
            pass

    def get_participants(self, group):
        """
        Identify all users who are participating with a given issue.
        """
        from sentry.models import User, UserOptionValue

        users = {
            user.id: user
            for user in
            User.objects.filter(
                sentry_orgmember_set__teams=group.project.teams.all(),
                is_active=True,
            )
        }

        excluded_ids = set()

        subscriptions = {
            subscription.user_id: subscription
            for subscription in
            GroupSubscription.objects.filter(
                group=group,
                user_id__in=users.keys(),
            )
        }

        for user_id, subscription in subscriptions.items():
            if not subscription.is_active:
                excluded_ids.add(user_id)

        options = get_user_options(
            'workflow:notifications',
            users.keys(),
            group.project,
            UserOptionValue.all_conversations,
        )

        for user_id, option in options.items():
            if option == UserOptionValue.no_conversations:
                excluded_ids.add(user_id)
            elif option == UserOptionValue.participating_only:
                if user_id not in subscriptions:
                    excluded_ids.add(user_id)

        results = {}

        for user_id, user in users.items():
            if user_id in excluded_ids:
                continue

            subscription = subscriptions.get(user_id)
            if subscription is not None:
                results[user] = subscription.reason
            else:
                results[user] = GroupSubscriptionReason.implicit

        return results


class GroupSubscription(Model):
    """
    Identifies a subscription relationship between a user and an issue.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', related_name="subscription_set")
    group = FlexibleForeignKey('sentry.Group', related_name="subscription_set")
    # namespace related_name on User since we don't own the model
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    is_active = models.BooleanField(default=True)
    reason = BoundedPositiveIntegerField(
        default=GroupSubscriptionReason.unknown,
    )
    date_added = models.DateTimeField(default=timezone.now, null=True)

    objects = GroupSubscriptionManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_groupsubscription'
        unique_together = (('group', 'user'), )

    __repr__ = sane_repr('project_id', 'group_id', 'user_id')
