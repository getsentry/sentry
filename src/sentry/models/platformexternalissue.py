from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedBigIntegerField, Model, sane_repr


class PlatformExternalIssue(Model):
    __core__ = False

    group_id = BoundedBigIntegerField()
    # external service that's linked to the sentry issue
    service_type = models.TextField()
    display_name = models.TextField()
    web_url = models.URlField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_platformexternalissue'
        unique_together = (('group_id', 'service_type'), )

    __repr__ = sane_repr('group_id', 'service_type', 'display_name', 'web_url')
