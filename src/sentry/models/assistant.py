from __future__ import absolute_import

from django.conf import settings
from django.db import models

from sentry.db.models import (
    BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
)


class AssistantActivity(Model):
    __core__ = False

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=False)
    guide_id = BoundedPositiveIntegerField()
    viewed_ts = models.DateTimeField(null=True)
    dismissed_ts = models.DateTimeField(null=True)
    snoozed_until_ts = models.DateTimeField(null=True)
    useful = models.NullBooleanField(default=False, null=True)

    __repr__ = sane_repr(
        'user',
        'guide_id',
        'viewed_ts',
        'dismissed_ts',
        'snoozed_until_ts',
        'useful')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_assistant_activity'
        unique_together = (('user', 'guide_id'), )
