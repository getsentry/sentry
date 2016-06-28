from __future__ import absolute_import

from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, BaseManager, sane_repr


class GroupSubscriptionManager(BaseManager):
    def subscribe(self, group, user):
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
                )
        except IntegrityError:
            pass


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
    date_added = models.DateTimeField(default=timezone.now, null=True)

    objects = GroupSubscriptionManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_groupsubscription'
        unique_together = (('group', 'user'),)

    __repr__ = sane_repr('project_id', 'group_id', 'user_id')
