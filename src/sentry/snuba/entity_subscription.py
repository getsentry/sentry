from __future__ import annotations

import re
from abc import ABC, abstractmethod
from collections.abc import Mapping, MutableMapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, TypedDict, Union

from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesRequest
from snuba_sdk import Column, Condition, Entity, Join, Op, Request

from sentry import features
from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.exceptions import InvalidQuerySubscription, UnsupportedQuerySubscription
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.builder.metrics import AlertMetricsQueryBuilder
from sentry.search.events.types import ParamsType, QueryBuilderConfig, SnubaParams
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve, resolve_tag_key, resolve_tag_values
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.extraction import MetricSpecType
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import get_timeseries_query
from sentry.utils import metrics

# TODO: If we want to support security events here we'll need a way to
# differentiate within the dataset. For now we can just assume all subscriptions
# created within this dataset are just for errors.
QUERY_TYPE_CONDITIONS: Mapping[SnubaQuery.Type, str] = {
    SnubaQuery.Type.ERROR: "event.type:error",
    SnubaQuery.Type.PERFORMANCE: "event.type:transaction",
}
ENTITY_TIME_COLUMNS: Mapping[EntityKey, str] = {
    EntityKey.Events: "timestamp",
    EntityKey.Sessions: "started",
    EntityKey.Transactions: "finish_ts",
    EntityKey.GenericMetricsCounters: "timestamp",
    EntityKey.GenericMetricsDistributions: "timestamp",
    EntityKey.GenericMetricsSets: "timestamp",
    EntityKey.GenericMetricsGauges: "timestamp",
    EntityKey.MetricsCounters: "timestamp",
    EntityKey.MetricsSets: "timestamp",
    EntityKey.EAPSpans: "timestamp",
}
CRASH_RATE_ALERT_AGGREGATE_RE = (
    r"^percentage\([ ]*(sessions_crashed|users_crashed)[ ]*\,[ ]*(sessions|users)[ ]*\)"
)
ALERT_BLOCKED_FIELDS = {
    "start",
    "end",
    "last_seen()",
    "time",
    "timestamp",
    "timestamp.to_hour",
    "timestamp.to_day",
}


def apply_dataset_query_conditions(
    query_type: SnubaQuery.Type,
    query: str,
    event_types: list[SnubaQueryEventType.EventType] | None,
    discover: bool = False,
) -> str:
    """
    Applies query dataset conditions to a query. This essentially turns a query like
    'release:123 or release:456' into '(event.type:error) AND (release:123 or release:456)'.
    :param dataset: The `QueryDataset` that the query applies to
    :param query: A string containing query to apply conditions to
    :param event_types: A list of EventType(s) to apply to the query
    :param discover: Whether this is intended for use with the discover dataset or not.
    When False, we won't modify queries for `Dataset.Transactions` at all. This is
    because the discover dataset requires that we always specify `event.type` so we can
    differentiate between errors and transactions, but the TRANSACTIONS dataset doesn't
    need it specified, and `event.type` ends up becoming a tag search.
    """
    if not discover and query_type == SnubaQuery.Type.PERFORMANCE:
        return query

    if event_types:
        event_type_conditions = " OR ".join(
            f"event.type:{event_type.name.lower()}" for event_type in event_types
        )
    elif query_type in QUERY_TYPE_CONDITIONS:
        event_type_conditions = QUERY_TYPE_CONDITIONS[query_type]
    else:
        return query

    if query:
        return f"({event_type_conditions}) AND ({query})"

    return event_type_conditions


class _EntitySpecificParams(TypedDict, total=False):
    org_id: int
    event_types: list[SnubaQueryEventType.EventType] | None


@dataclass
class _EntitySubscription:
    query_type: SnubaQuery.Type
    dataset: Dataset


class BaseEntitySubscription(ABC, _EntitySubscription):
    """
    An abstraction layer for all different entity subscriptions. It is important to note that
    this abstraction layer was added because the subscription logic was too coupled to the
    events and transactions entities, which was fine initially but now as we are adding more
    entities to support subscriptions (alerts), we need to decouple this logic.
    """

    def __init__(
        self, aggregate: str, time_window: int, extra_fields: _EntitySpecificParams | None = None
    ):
        pass

    @abstractmethod
    def get_entity_extra_params(self) -> Mapping[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def aggregate_query_results(
        self, data: list[dict[str, Any]], alias: str | None = None
    ) -> list[dict[str, Any]]:
        """
        Method that serves the purpose of receiving query results and applying any necessary
        aggregations on them
        """
        raise NotImplementedError

    def build_query_builder(
        self,
        query: str,
        project_ids: list[int],
        environment: Environment | None,
        params: ParamsType | None = None,
        skip_field_validation_for_entity_subscription_deletion: bool = False,
    ) -> BaseQueryBuilder:
        raise NotImplementedError

    def build_rpc_request(
        self,
        query: str,
        project_ids: list[int],
        environment: Environment | None,
        params: ParamsType | None = None,
        skip_field_validation_for_entity_subscription_deletion: bool = False,
        referrer: str = Referrer.API_ALERTS_ALERT_RULE_CHART.value,
    ) -> TimeSeriesRequest:
        raise NotImplementedError


class BaseEventsAndTransactionEntitySubscription(BaseEntitySubscription, ABC):
    def __init__(
        self, aggregate: str, time_window: int, extra_fields: _EntitySpecificParams | None = None
    ):
        super().__init__(aggregate, time_window, extra_fields)
        self.aggregate = aggregate
        self.event_types = None
        if extra_fields:
            self.event_types = extra_fields.get("event_types")

    def build_query_builder(
        self,
        query: str,
        project_ids: list[int],
        environment: Environment | None,
        params: ParamsType | None = None,
        skip_field_validation_for_entity_subscription_deletion: bool = False,
    ) -> BaseQueryBuilder:
        from sentry.search.events.builder.errors import ErrorsQueryBuilder

        if params is None:
            params = {}

        params["project_id"] = project_ids

        query = apply_dataset_query_conditions(self.query_type, query, self.event_types)
        if environment:
            params["environment"] = environment.name

        query_builder_cls = DiscoverQueryBuilder
        parser_config_overrides: MutableMapping[str, Any] = {"blocked_keys": ALERT_BLOCKED_FIELDS}
        if self.dataset == Dataset.Events:
            from sentry.snuba.errors import PARSER_CONFIG_OVERRIDES

            query_builder_cls = ErrorsQueryBuilder
            parser_config_overrides.update(PARSER_CONFIG_OVERRIDES)

        return query_builder_cls(
            dataset=Dataset(self.dataset.value),
            query=query,
            selected_columns=[self.aggregate],
            params=params,
            offset=None,
            limit=None,
            config=QueryBuilderConfig(
                skip_time_conditions=True,
                parser_config_overrides=parser_config_overrides,
                skip_field_validation_for_entity_subscription_deletion=skip_field_validation_for_entity_subscription_deletion,
                use_entity_prefix_for_fields=True,
            ),
        )

    def get_entity_extra_params(self) -> Mapping[str, Any]:
        return {}

    def aggregate_query_results(
        self, data: list[dict[str, Any]], alias: str | None = None
    ) -> list[dict[str, Any]]:
        return data


class EventsEntitySubscription(BaseEventsAndTransactionEntitySubscription):
    query_type = SnubaQuery.Type.ERROR
    dataset = Dataset.Events


class PerformanceTransactionsEntitySubscription(BaseEventsAndTransactionEntitySubscription):
    query_type = SnubaQuery.Type.PERFORMANCE
    dataset = Dataset.Transactions


class PerformanceSpansEAPRpcEntitySubscription(BaseEntitySubscription):
    query_type = SnubaQuery.Type.PERFORMANCE
    dataset = Dataset.EventsAnalyticsPlatform

    def __init__(
        self, aggregate: str, time_window: int, extra_fields: _EntitySpecificParams | None = None
    ):
        super().__init__(aggregate, time_window, extra_fields)
        self.aggregate = aggregate
        self.event_types = None
        self.time_window = time_window
        if extra_fields:
            self.org_id = extra_fields.get("org_id")
            self.event_types = extra_fields.get("event_types")

    def build_rpc_request(
        self,
        query: str,
        project_ids: list[int],
        environment: Environment | None,
        params: ParamsType | None = None,
        skip_field_validation_for_entity_subscription_deletion: bool = False,
        referrer: str = Referrer.API_ALERTS_ALERT_RULE_CHART.value,
    ) -> TimeSeriesRequest:
        if params is None:
            params = {}

        params["project_id"] = project_ids

        query = apply_dataset_query_conditions(self.query_type, query, self.event_types)
        if environment:
            params["environment"] = environment.name

        now = datetime.now(tz=timezone.utc)
        snuba_params = SnubaParams(
            environments=[environment],
            projects=[Project.objects.get_from_cache(id=project_id) for project_id in project_ids],
            organization=Organization.objects.get_from_cache(id=self.org_id),
            start=now - timedelta(days=1),
            end=now,
        )

        rpc_request, _, _ = get_timeseries_query(
            params=snuba_params,
            query_string=query,
            y_axes=[self.aggregate],
            groupby=[],
            referrer=referrer,
            config=SearchResolverConfig(),
            granularity_secs=self.time_window,
        )

        return rpc_request

    def get_entity_extra_params(self) -> Mapping[str, Any]:
        return {}

    def aggregate_query_results(
        self, data: list[dict[str, Any]], alias: str | None = None
    ) -> list[dict[str, Any]]:
        return data


class BaseMetricsEntitySubscription(BaseEntitySubscription, ABC):
    def __init__(
        self, aggregate: str, time_window: int, extra_fields: _EntitySpecificParams | None = None
    ):
        super().__init__(aggregate, time_window, extra_fields)
        self.aggregate = aggregate
        if not extra_fields or "org_id" not in extra_fields:
            raise InvalidQuerySubscription(
                "org_id is a required param when "
                "building snuba filter for a metrics subscription"
            )
        self.org_id = extra_fields["org_id"]
        self.time_window = time_window
        self.use_metrics_layer = False

        self.on_demand_metrics_enabled = features.has(
            "organizations:on-demand-metrics-extraction",
            Organization.objects.get_from_cache(id=self.org_id),
        )

    @abstractmethod
    def get_snql_aggregations(self) -> list[str]:
        raise NotImplementedError

    @abstractmethod
    def get_snql_extra_conditions(self) -> list[Condition]:
        raise NotImplementedError

    @abstractmethod
    def get_granularity(self) -> int:
        pass

    def get_entity_extra_params(self) -> Mapping[str, Any]:
        return {
            "organization": self.org_id,
            "granularity": self.get_granularity(),
        }

    def _get_use_case_id(self) -> UseCaseID:
        if self.dataset == Dataset.PerformanceMetrics:
            return UseCaseID.TRANSACTIONS
        else:
            return UseCaseID.SESSIONS

    def resolve_tag_key_if_needed(self, string: str) -> str:
        if self.use_metrics_layer:
            return string

        return resolve_tag_key(self._get_use_case_id(), self.org_id, string)

    def resolve_tag_values_if_needed(self, strings: Sequence[str]) -> Sequence[str | int]:
        if self.use_metrics_layer:
            return strings

        return resolve_tag_values(self._get_use_case_id(), self.org_id, strings)

    def build_query_builder(
        self,
        query: str,
        project_ids: list[int],
        environment: Environment | None,
        params: ParamsType | None = None,
        skip_field_validation_for_entity_subscription_deletion: bool = False,
    ) -> BaseQueryBuilder:

        if params is None:
            params = {}

        if environment:
            params["environment"] = environment.name

        query = apply_dataset_query_conditions(self.query_type, query, None)
        params["project_id"] = project_ids
        params["use_case_id"] = self._get_use_case_id().value
        qb = AlertMetricsQueryBuilder(
            dataset=Dataset(self.dataset.value),
            query=query,
            selected_columns=self.get_snql_aggregations(),
            params=params,
            offset=None,
            granularity=self.get_granularity(),
            time_range_window=self.time_window,
            config=QueryBuilderConfig(
                skip_time_conditions=True,
                use_metrics_layer=self.use_metrics_layer,
                on_demand_metrics_enabled=self.on_demand_metrics_enabled,
                on_demand_metrics_type=MetricSpecType.SIMPLE_QUERY,
                skip_field_validation_for_entity_subscription_deletion=skip_field_validation_for_entity_subscription_deletion,
                insights_metrics_override_metric_layer=True,
            ),
        )

        extra_conditions = self.get_snql_extra_conditions()
        qb.add_conditions(extra_conditions)

        return qb


class PerformanceMetricsEntitySubscription(BaseMetricsEntitySubscription):
    query_type = SnubaQuery.Type.PERFORMANCE
    dataset = Dataset.PerformanceMetrics

    def get_snql_aggregations(self) -> list[str]:
        return [self.aggregate]

    def get_snql_extra_conditions(self) -> list[Condition]:
        return []

    def aggregate_query_results(
        self, data: list[dict[str, Any]], alias: str | None = None
    ) -> list[dict[str, Any]]:
        return data

    def get_granularity(self) -> int:
        # Both time_window and granularity are in seconds
        # Time windows <= 1h -> Granularity 60s
        # Time windows > 1h and <= 24h -> Granularity 1 hour
        # Time windows > 24h -> Granularity 1 day
        if self.time_window <= 3600:
            return 60
        elif 3600 < self.time_window <= 24 * 3600:
            return 3600
        else:
            return 24 * 3600


class BaseCrashRateMetricsEntitySubscription(BaseMetricsEntitySubscription):
    query_type = SnubaQuery.Type.CRASH_RATE
    dataset = Dataset.Metrics
    metric_key: SessionMRI

    def get_granularity(self) -> int:
        # Both time_window and granularity are in seconds
        # Time windows <= 1h -> Granularity 10s
        # Time windows > 1h & <= 4h -> Granularity 60s
        # Time windows > 4h and <= 24h -> Granularity 1 hour
        # Time windows > 24h -> Granularity 1 day
        if self.time_window <= 3600:
            granularity = 10
        elif self.time_window <= 4 * 3600:
            granularity = 60
        elif 4 * 3600 < self.time_window <= 24 * 3600:
            granularity = 3600
        else:
            granularity = 24 * 3600
        return granularity

    def aggregate_query_results(
        self, data: list[dict[str, Any]], alias: str | None = None
    ) -> list[dict[str, Any]]:
        aggregated_results: list[dict[str, Any]]
        if not data:
            total_count = 0
            crash_count = 0
        else:
            assert len(data) == 1
            row = data[0]
            total_count = row["count"]

            crash_count = row["crashed"]

        if total_count == 0:
            metrics.incr(
                "incidents.entity_subscription.metrics.aggregate_query_results.no_session_data"
            )
            crash_free_rate = None
        else:
            crash_free_rate = round((1 - crash_count / total_count) * 100, 3)

        col_name = alias if alias else CRASH_RATE_ALERT_AGGREGATE_ALIAS
        aggregated_results = [{col_name: crash_free_rate}]
        return aggregated_results

    def get_snql_extra_conditions(self) -> list[Condition]:
        # If we don't use the metrics layer we need to filter by metric here. The metrics layer does this automatically.
        if not self.use_metrics_layer:
            return [
                Condition(
                    Column("metric_id"),
                    Op.EQ,
                    resolve(UseCaseID.SESSIONS, self.org_id, self.metric_key.value),
                )
            ]

        return []


class MetricsCountersEntitySubscription(BaseCrashRateMetricsEntitySubscription):
    metric_key: SessionMRI = SessionMRI.RAW_SESSION

    def get_snql_aggregations(self) -> list[str]:
        return [
            "sumIf(session.status, init) as count",
            "sumIf(session.status, crashed) as crashed",
        ]

    def get_snql_extra_conditions(self) -> list[Condition]:
        extra_conditions = super().get_snql_extra_conditions()

        # We keep this condition for optimization reasons because the where clause is executed before the select, thus
        # resulting in a smaller result set for the sumIf function(s).
        extra_conditions.append(
            Condition(
                Column(self.resolve_tag_key_if_needed("session.status")),
                Op.IN,
                self.resolve_tag_values_if_needed(["crashed", "init"]),
            )
        )

        return extra_conditions


class MetricsSetsEntitySubscription(BaseCrashRateMetricsEntitySubscription):
    metric_key: SessionMRI = SessionMRI.RAW_USER

    def get_snql_aggregations(self) -> list[str]:
        return [
            "uniq() as count",
            "uniqIf(session.status, crashed) as crashed",
        ]


EntitySubscription = Union[
    EventsEntitySubscription,
    MetricsCountersEntitySubscription,
    MetricsSetsEntitySubscription,
    PerformanceTransactionsEntitySubscription,
    PerformanceMetricsEntitySubscription,
    PerformanceSpansEAPRpcEntitySubscription,
]


def get_entity_subscription(
    query_type: SnubaQuery.Type,
    dataset: Dataset,
    aggregate: str,
    time_window: int,
    extra_fields: _EntitySpecificParams | None = None,
) -> EntitySubscription:
    """
    Function that routes to the correct instance of `EntitySubscription` based on the query type and
    dataset, and additionally does validation on aggregate for the sessions and metrics datasets
    then returns the instance of `EntitySubscription`
    """
    entity_subscription_cls: type[EntitySubscription] | None = None
    if query_type == SnubaQuery.Type.ERROR:
        entity_subscription_cls = EventsEntitySubscription
    if query_type == SnubaQuery.Type.PERFORMANCE:
        if dataset == Dataset.Transactions:
            entity_subscription_cls = PerformanceTransactionsEntitySubscription
        elif dataset in (Dataset.Metrics, Dataset.PerformanceMetrics):
            entity_subscription_cls = PerformanceMetricsEntitySubscription
        elif dataset == Dataset.EventsAnalyticsPlatform:
            entity_subscription_cls = PerformanceSpansEAPRpcEntitySubscription
    if query_type == SnubaQuery.Type.CRASH_RATE:
        entity_key = determine_crash_rate_alert_entity(aggregate)
        if entity_key == EntityKey.MetricsCounters:
            entity_subscription_cls = MetricsCountersEntitySubscription
        if entity_key == EntityKey.MetricsSets:
            entity_subscription_cls = MetricsSetsEntitySubscription

    if entity_subscription_cls is None:
        raise UnsupportedQuerySubscription(
            f"Couldn't determine entity subscription for query type {query_type} with dataset {dataset}"
        )

    return entity_subscription_cls(aggregate, time_window, extra_fields)


def determine_crash_rate_alert_entity(aggregate: str) -> EntityKey:
    match = re.match(CRASH_RATE_ALERT_AGGREGATE_RE, aggregate)
    if not match:
        raise UnsupportedQuerySubscription(
            "Only crash free percentage queries are supported for crash rate alerts"
        )
    count_col_matched = match.group(2)
    return EntityKey.MetricsCounters if count_col_matched == "sessions" else EntityKey.MetricsSets


def get_entity_key_from_request(request: Request) -> EntityKey:
    match = request.query.match
    if isinstance(match, Join):
        # XXX: Is there a better way to handle this
        match = match.relationships[0].lhs
    return EntityKey(match.name)


def get_entity_from_query_builder(query_builder: BaseQueryBuilder) -> Entity | None:
    request = query_builder.get_snql_query()
    match = request.query.match
    if isinstance(match, Join):
        # need to specify Entity for Join queries
        match = match.relationships[0].lhs
        return Entity(name=match.name, alias=match.name)
    return None


def get_entity_key_from_query_builder(query_builder: BaseQueryBuilder) -> EntityKey:
    return get_entity_key_from_request(query_builder.get_snql_query())


def get_entity_subscription_from_snuba_query(
    snuba_query: SnubaQuery, organization_id: int
) -> EntitySubscription:
    query_dataset = Dataset(snuba_query.dataset)
    return get_entity_subscription(
        SnubaQuery.Type(snuba_query.type),
        query_dataset,
        snuba_query.aggregate,
        snuba_query.time_window,
        extra_fields={
            "org_id": organization_id,
            "event_types": snuba_query.event_types,
        },
    )


def get_entity_key_from_snuba_query(
    snuba_query: SnubaQuery,
    organization_id: int,
    project_id: int,
    skip_field_validation_for_entity_subscription_deletion: bool = False,
) -> EntityKey:
    query_dataset = Dataset(snuba_query.dataset)
    if query_dataset == Dataset.EventsAnalyticsPlatform:
        return EntityKey.EAPSpans
    entity_subscription = get_entity_subscription_from_snuba_query(
        snuba_query,
        organization_id,
    )
    query_builder = entity_subscription.build_query_builder(
        snuba_query.query,
        [project_id],
        snuba_query.environment,
        {"organization_id": organization_id},
        skip_field_validation_for_entity_subscription_deletion=skip_field_validation_for_entity_subscription_deletion,
    )
    return get_entity_key_from_query_builder(query_builder)
