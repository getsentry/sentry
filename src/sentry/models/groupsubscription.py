from __future__ import absolute_import

from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField, FlexibleForeignKey, Model, BaseManager,
    sane_repr
)


class GroupSubscriptionReason(object):
    unknown = 0
    comment = 1
    assigned = 2
    bookmark = 3
    status_change = 4


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

        # identify all members of a project
        users = User.objects.filter(
            sentry_orgmember_set__teams=group.project.team,
        )

        # TODO(dcramer): allow members to change from default particpating to
        # explicit
        users = users.exclude(
            id__in=GroupSubscription.objects.filter(
                group=group,
                is_active=False,
                user__in=users,
            ).values('user')
        )

        participating_only = set(UserOption.objects.filter(
            user__in=users,
            key='workflow:notifications',
            value=UserOptionValue.participating_only,
        ).values_list('user', flat=True))

        if participating_only:
            excluded = participating_only.difference(
                GroupSubscription.objects.filter(
                    group=group,
                    is_active=True,
                    user__in=participating_only,
                ).values_list('user', flat=True)
            )

            if excluded:
                users = users.exclude(
                    id__in=excluded,
                )

        return list(users)


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
