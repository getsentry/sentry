from datetime import timedelta
from enum import Enum

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.manager import BaseManager


class QueryAggregations(Enum):
    TOTAL = 0
    UNIQUE_USERS = 1


query_aggregation_to_snuba = {
    QueryAggregations.TOTAL: ("count()", "", "count"),
    QueryAggregations.UNIQUE_USERS: ("uniq", "tags[sentry:user]", "unique_users"),
}


@region_silo_only_model
class SnubaQuery(Model):
    __include_in_export__ = True

    class Type(Enum):
        ERROR = 0
        PERFORMANCE = 1
        CRASH_RATE = 2

    environment = FlexibleForeignKey("sentry.Environment", null=True, db_constraint=False)
    # Possible values are in the the `Type` enum
    type = models.SmallIntegerField()
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


@region_silo_only_model
class SnubaQueryEventType(Model):
    __include_in_export__ = True

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


@region_silo_only_model
class QuerySubscription(DefaultFieldsModel):
    __include_in_export__ = True

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
