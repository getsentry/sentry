from __future__ import annotations

from datetime import timedelta
from enum import Enum
from typing import TYPE_CHECKING, ClassVar, Self

from django.db import models
from django.utils import timezone

from sentry.backup.dependencies import ImportKind, PrimaryKeyMap, get_model_name
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model
from sentry.db.models.manager.base import BaseManager
from sentry.models.team import Team
from sentry.users.models.user import User
from sentry.workflow_engine.registry import data_source_type_registry
from sentry.workflow_engine.types import DataSourceTypeHandler

if TYPE_CHECKING:
    from sentry.workflow_engine.models.data_source import DataSource


class QueryAggregations(Enum):
    TOTAL = 0
    UNIQUE_USERS = 1


query_aggregation_to_snuba = {
    QueryAggregations.TOTAL: ("count()", "", "count"),
    QueryAggregations.UNIQUE_USERS: ("uniq", "tags[sentry:user]", "unique_users"),
}


@region_silo_model
class SnubaQuery(Model):
    __relocation_scope__ = RelocationScope.Organization
    __relocation_dependencies__ = {"sentry.Organization", "sentry.Project"}

    class Type(Enum):
        ERROR = 0
        PERFORMANCE = 1
        CRASH_RATE = 2

    environment = FlexibleForeignKey("sentry.Environment", null=True, db_constraint=False)
    # Possible values are in the `Type` enum
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

    @classmethod
    def query_for_relocation_export(cls, q: models.Q, pk_map: PrimaryKeyMap) -> models.Q:
        from sentry.incidents.models.alert_rule import AlertRule
        from sentry.models.organization import Organization
        from sentry.models.project import Project

        from_alert_rule = AlertRule.objects.filter(
            models.Q(user_id__in=pk_map.get_pks(get_model_name(User)))
            | models.Q(team_id__in=pk_map.get_pks(get_model_name(Team)))
            | models.Q(organization_id__in=pk_map.get_pks(get_model_name(Organization)))
        ).values_list("snuba_query_id", flat=True)

        from_query_subscription = QuerySubscription.objects.filter(
            project_id__in=pk_map.get_pks(get_model_name(Project))
        ).values_list("snuba_query_id", flat=True)

        return q & models.Q(pk__in=set(from_alert_rule).union(set(from_query_subscription)))


@region_silo_model
class SnubaQueryEventType(Model):
    __relocation_scope__ = RelocationScope.Organization

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


@region_silo_model
class QuerySubscription(Model):
    __relocation_scope__ = RelocationScope.Organization

    class Status(Enum):
        ACTIVE = 0
        CREATING = 1
        UPDATING = 2
        DELETING = 3
        DISABLED = 4

    # NOTE: project fk SHOULD match AlertRule's fk
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    snuba_query = FlexibleForeignKey("sentry.SnubaQuery", null=True, related_name="subscriptions")
    type = (
        models.TextField()
    )  # Text identifier for the subscription type this is. Used to identify the registered callback associated with this subscription.
    status = models.SmallIntegerField(default=Status.ACTIVE.value, db_index=True)
    subscription_id = models.TextField(unique=True, null=True)
    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(default=timezone.now, null=True)
    query_extra = models.TextField(
        null=True
    )  # additional query filters to attach to the query created in Snuba such as datetime filters, or release/deploy tags

    objects: ClassVar[BaseManager[Self]] = BaseManager(
        cache_fields=("pk", "subscription_id"), cache_ttl=int(timedelta(hours=1).total_seconds())
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_querysubscription"

    # We want the `QuerySubscription` to get properly created in Snuba, so we'll run it through the
    # purpose-built logic for that operation rather than copying the data verbatim. This will result
    # in an identical duplicate of the `QuerySubscription` model with a unique `subscription_id`.
    def write_relocation_import(
        self, _s: ImportScope, _f: ImportFlags
    ) -> tuple[int, ImportKind] | None:
        # TODO(getsentry/team-ospo#190): Prevents a circular import; could probably split up the
        # source module in such a way that this is no longer an issue.
        from sentry.snuba.subscriptions import create_snuba_subscription

        subscription = create_snuba_subscription(self.project, self.type, self.snuba_query)

        # Keep the original creation date.
        subscription.date_added = self.date_added
        subscription.save()

        return (subscription.pk, ImportKind.Inserted)


@data_source_type_registry.register("snuba_query_subscription")
class QuerySubscriptionDataSourceHandler(DataSourceTypeHandler[QuerySubscription]):
    @staticmethod
    def bulk_get_query_object(
        data_sources: list[DataSource],
    ) -> dict[int, QuerySubscription | None]:
        qs_lookup = {
            qs.id: qs
            for qs in QuerySubscription.objects.filter(id__in=[ds.query_id for ds in data_sources])
        }
        return {ds.id: qs_lookup.get(ds.query_id) for ds in data_sources}
