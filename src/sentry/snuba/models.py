from datetime import timedelta
from enum import Enum

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.manager import BaseManager


class QueryAggregations(Enum):
    TOTAL = 0
    UNIQUE_USERS = 1


query_aggregation_to_snuba = {
    QueryAggregations.TOTAL: ("count()", "", "count"),
    QueryAggregations.UNIQUE_USERS: ("uniq", "tags[sentry:user]", "unique_users"),
}


class QueryDatasets(Enum):
    EVENTS = "events"
    TRANSACTIONS = "transactions"


class SnubaQuery(Model):
    __core__ = True

    environment = FlexibleForeignKey("sentry.Environment", null=True, db_constraint=False)
    dataset = models.TextField()
    query = models.TextField()
    aggregate = models.TextField()
    time_window = models.IntegerField()
    resolution = models.IntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_snubaquery"

    @property
    def event_types(self):
        return [type.event_type for type in self.snubaqueryeventtype_set.all()]


class SnubaQueryEventType(Model):
    __core__ = True

    class EventType(Enum):
        ERROR = 0
        DEFAULT = 1
        TRANSACTION = 2

    snuba_query = FlexibleForeignKey("sentry.SnubaQuery")
    type = models.SmallIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_snubaqueryeventtype"
        unique_together = (("snuba_query", "type"),)

    @property
    def event_type(self):
        return self.EventType(self.type)


class QuerySubscription(DefaultFieldsModel):
    __core__ = True

    class Status(Enum):
        ACTIVE = 0
        CREATING = 1
        UPDATING = 2
        DELETING = 3
        DISABLED = 4

    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    snuba_query = FlexibleForeignKey("sentry.SnubaQuery", null=True, related_name="subscriptions")
    type = models.TextField()
    status = models.SmallIntegerField(default=Status.ACTIVE.value, db_index=True)
    subscription_id = models.TextField(unique=True, null=True)
    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(default=timezone.now, null=True)

    objects = BaseManager(
        cache_fields=("pk", "subscription_id"), cache_ttl=int(timedelta(hours=1).total_seconds())
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_querysubscription"
