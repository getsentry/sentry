from __future__ import absolute_import

from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.db.models import Q
from django.utils import timezone

from sentry.db.models import (
    BaseManager, BoundedPositiveIntegerField, FlexibleForeignKey, Model,
    sane_repr
)


class GroupSubscriptionReason(object):
    committed = -2  # not for use as a persisted field value
    implicit = -1   # not for use as a persisted field value

    unknown = 0
    comment = 1
    assigned = 2
    bookmark = 3
    status_change = 4

    descriptions = {
        implicit: u"have opted to receive updates for all issues within "
                  "projects that you are a member of",
        committed: u"were involved in a commit that is part of this release",
        comment: u"have commented on this issue",
        assigned: u"have been assigned to this issue",
        bookmark: u"have bookmarked this issue",
        status_change: u"have changed the resolution status of this issue",
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
        from sentry.models import User, UserOption, UserOptionValue

        # Identify all members of a project -- we'll use this to start figuring
        # out who could possibly be associated with this group due to implied
        # subscriptions.
        users = User.objects.filter(
            sentry_orgmember_set__teams=group.project.team,
            is_active=True,
        )

        # Obviously, users who have explicitly unsubscribed from this issue
        # aren't considered participants.
        users = users.exclude(
            id__in=GroupSubscription.objects.filter(
                group=group,
                is_active=False,
                user__in=users,
            ).values('user')
        )

        # Fetch all of the users that have been explicitly associated with this
        # issue.
        participants = {
            subscription.user: subscription.reason
            for subscription in
            GroupSubscription.objects.filter(
                group=group,
                is_active=True,
                user__in=users,
            ).select_related('user')
        }

        # Find users which by default do not subscribe.
        participating_only = set(
            UserOption.objects.filter(
                Q(project__isnull=True) | Q(project=group.project),
                user__in=users,
                key='workflow:notifications',
                value=UserOptionValue.participating_only,
            ).exclude(
                user__in=UserOption.objects.filter(
                    user__in=users,
                    key='workflow:notifications',
                    project=group.project,
                    value=UserOptionValue.all_conversations,
                )
            ).values_list('user', flat=True)
        )

        if participating_only:
            excluded = participating_only.difference(participants.keys())
            if excluded:
                users = users.exclude(id__in=excluded)

        results = {}

        for user in users:
            results[user] = GroupSubscriptionReason.implicit

        for user, reason in participants.items():
            results[user] = reason

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
        unique_together = (('group', 'user'),)

    __repr__ = sane_repr('project_id', 'group_id', 'user_id')
