from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import ArrayField, FlexibleForeignKey, Model


class QuerySubscription(Model):
    __core__ = True

    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    type = models.TextField()
    subscription_id = models.TextField(unique=True)
    dataset = models.TextField()
    query = models.TextField()
    aggregations = ArrayField(of=models.IntegerField)
    time_window = models.IntegerField()
    resolution = models.IntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_querysubscription"
