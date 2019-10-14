from __future__ import absolute_import

from enum import Enum

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model


class QueryAggregations(Enum):
    TOTAL = 0
    UNIQUE_USERS = 1


class QueryDatasets(Enum):
    EVENTS = "events"


class QuerySubscription(Model):
    __core__ = True

    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    type = models.TextField()
    subscription_id = models.TextField(unique=True)
    dataset = models.TextField()
    query = models.TextField()
    # TODO: Remove this default after we migrate
    aggregation = models.IntegerField(default=0)
    time_window = models.IntegerField()
    resolution = models.IntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_querysubscription"
