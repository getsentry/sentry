import re
from abc import ABC, abstractmethod
from copy import copy
from dataclasses import dataclass
from typing import (
    Any,
    Dict,
    List,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    Tuple,
    Type,
    TypedDict,
    Union,
)

from snuba_sdk import Request

from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS, CRASH_RATE_ALERT_SESSION_COUNT_ALIAS
from sentry.eventstore import Filter
from sentry.exceptions import InvalidQuerySubscription, UnsupportedQuerySubscription
from sentry.models import Environment
from sentry.search.events.fields import resolve_field_list
from sentry.search.events.filter import get_filter
from sentry.sentry_metrics.utils import (
    MetricIndexNotFound,
    resolve,
    resolve_tag_key,
    resolve_weak,
    reverse_resolve,
)
from sentry.snuba.dataset import EntityKey
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.snuba.models import QueryDatasets, SnubaQueryEventType
from sentry.utils import metrics
from sentry.utils.snuba import Dataset, resolve_column, resolve_snuba_aliases

# TODO: If we want to support security events here we'll need a way to
# differentiate within the dataset. For now we can just assume all subscriptions
# created within this dataset are just for errors.
DATASET_CONDITIONS: Mapping[QueryDatasets, str] = {
    QueryDatasets.EVENTS: "event.type:error",
    QueryDatasets.TRANSACTIONS: "event.type:transaction",
}
ENTITY_TIME_COLUMNS: Mapping[EntityKey, str] = {
    EntityKey.Events: "timestamp",
    EntityKey.Sessions: "started",
    EntityKey.Transactions: "finish_ts",
    EntityKey.MetricsCounters: "timestamp",
    EntityKey.MetricsSets: "timestamp",
}
CRASH_RATE_ALERT_AGGREGATE_RE = (
    r"^percentage\([ ]*(sessions_crashed|users_crashed)[ ]*\,[ ]*(sessions|users)[ ]*\)"
)


def apply_dataset_query_conditions(
    dataset: QueryDatasets,
    query: str,
    event_types: Optional[List[SnubaQueryEventType]],
    discover: bool = False,
) -> str:
    """
    Applies query dataset conditions to a query. This essentially turns a query like
    'release:123 or release:456' into '(event.type:error) AND (release:123 or release:456)'.
    :param dataset: The `QueryDataset` that the query applies to
    :param query: A string containing query to apply conditions to
    :param event_types: A list of EventType(s) to apply to the query
    :param discover: Whether this is intended for use with the discover dataset or not.
    When False, we won't modify queries for `QueryDatasets.TRANSACTIONS` at all. This is
    because the discover dataset requires that we always specify `event.type` so we can
    differentiate between errors and transactions, but the TRANSACTIONS dataset doesn't
    need it specified, and `event.type` ends up becoming a tag search.
    """
    if not discover and dataset == QueryDatasets.TRANSACTIONS:
        return query

    if event_types:
        event_type_conditions = " OR ".join(
            f"event.type:{event_type.name.lower()}" for event_type in event_types
        )
    elif dataset in DATASET_CONDITIONS:
        event_type_conditions = DATASET_CONDITIONS[dataset]
    else:
        return query

    if query:
        return f"({event_type_conditions}) AND ({query})"

    return event_type_conditions


class _EntitySpecificParams(TypedDict, total=False):
    org_id: int
    event_types: Optional[List[SnubaQueryEventType.EventType]]


@dataclass
class _EntitySubscription:
    entity_key: EntityKey
    dataset: QueryDatasets
    time_col: str


class BaseEntitySubscription(ABC, _EntitySubscription):
    """
    An abstraction layer for all different entity subscriptions. It is important to note that
    this abstraction layer was added because the subscription logic was too coupled to the
    events and transactions entities, which was fine initially but now as we are adding more
    entities to support subscriptions (alerts), we need to decouple this logic.
    """

    def __init__(
        self, aggregate: str, time_window: int, extra_fields: Optional[_EntitySpecificParams] = None
    ):
        self.time_col = ENTITY_TIME_COLUMNS[self.entity_key]

    @abstractmethod
    def build_snuba_filter(
        self,
        query: str,
        environment: Optional[Environment],
        params: Optional[Mapping[str, Any]] = None,
    ) -> Filter:
        raise NotImplementedError

    @abstractmethod
    def get_entity_extra_params(self) -> Mapping[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def aggregate_query_results(
        self, data: List[Dict[str, Any]], alias: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Method that serves the purpose of receiving query results and applying any necessary
        aggregations on them
        """
        raise NotImplementedError

    def build_snql_query(
        self,
        query: str,
        project_ids: Sequence[int],
        environment: Optional[Environment],
        params: Optional[MutableMapping[str, Any]] = None,
    ) -> Request:
        pass


class BaseEventsAndTransactionEntitySubscription(BaseEntitySubscription, ABC):
    def __init__(
        self, aggregate: str, time_window: int, extra_fields: Optional[_EntitySpecificParams] = None
    ):
        super().__init__(aggregate, time_window, extra_fields)
        self.aggregate = aggregate
        self.event_types = None
        if extra_fields:
            self.event_types = extra_fields.get("event_types")

    def build_snuba_filter(
        self,
        query: str,
        environment: Optional[Environment],
        params: Optional[Mapping[str, Any]] = None,
    ) -> Filter:
        resolve_func = resolve_column(Dataset(self.dataset.value))

        query = apply_dataset_query_conditions(QueryDatasets(self.dataset), query, self.event_types)
        snuba_filter = get_filter(query, params=params)
        snuba_filter.update_with(
            resolve_field_list([self.aggregate], snuba_filter, auto_fields=False)
        )
        snuba_filter = resolve_snuba_aliases(snuba_filter, resolve_func)[0]
        if snuba_filter.group_ids:
            snuba_filter.conditions.append(
                ["group_id", "IN", list(map(int, snuba_filter.group_ids))]
            )
        if environment:
            snuba_filter.conditions.append(["environment", "=", environment.name])
        return snuba_filter

    def build_snql_query(
        self,
        query: str,
        project_ids: Sequence[int],
        environment: Optional[Environment],
        params: Optional[MutableMapping[str, Any]] = None,
    ) -> Request:
        from sentry.search.events.builder import QueryBuilder

        if params is None:
            params = {}

        params["project_id"] = project_ids

        query = apply_dataset_query_conditions(QueryDatasets(self.dataset), query, self.event_types)
        if environment:
            params["environment"] = environment.name

        return QueryBuilder(
            dataset=Dataset(self.dataset.value),
            query=query,
            selected_columns=[self.aggregate],
            params=params,
            offset=None,
            limit=None,
            skip_time_conditions=True,
        ).get_snql_query()

    def get_entity_extra_params(self) -> Mapping[str, Any]:
        return {}

    def aggregate_query_results(
        self, data: List[Dict[str, Any]], alias: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        return data


class EventsEntitySubscription(BaseEventsAndTransactionEntitySubscription):
    dataset = QueryDatasets.EVENTS
    entity_key = EntityKey.Events


class TransactionsEntitySubscription(BaseEventsAndTransactionEntitySubscription):
    dataset = QueryDatasets.TRANSACTIONS
    entity_key = EntityKey.Transactions


class SessionsEntitySubscription(BaseEntitySubscription):
    dataset = QueryDatasets.SESSIONS
    entity_key = EntityKey.Sessions

    def __init__(
        self, aggregate: str, time_window: int, extra_fields: Optional[_EntitySpecificParams] = None
    ):
        super().__init__(aggregate, time_window, extra_fields)
        self.aggregate = aggregate
        if not extra_fields or "org_id" not in extra_fields:
            raise InvalidQuerySubscription(
                "org_id is a required param when "
                "building snuba filter for a metrics subscription"
            )
        self.org_id = extra_fields["org_id"]

    def build_snuba_filter(
        self,
        query: str,
        environment: Optional[Environment],
        params: Optional[Mapping[str, Any]] = None,
    ) -> Filter:
        resolve_func = resolve_column(Dataset(self.dataset.value))
        aggregations = [self.aggregate]
        # This aggregation is added to return the total number of sessions in crash
        # rate alerts that is used to identify if we are below a general minimum alert threshold
        count_col = re.search(r"(sessions|users)", self.aggregate)
        if not count_col:
            raise UnsupportedQuerySubscription(
                "Only crash free percentage queries are supported for subscriptions"
                "over the sessions dataset"
            )
        count_col_matched = count_col.group()

        aggregations += [f"identity({count_col_matched}) AS {CRASH_RATE_ALERT_SESSION_COUNT_ALIAS}"]
        functions_acl = ["identity"]
        snuba_filter = get_filter(query, params=params)
        snuba_filter.update_with(
            resolve_field_list(
                aggregations, snuba_filter, auto_fields=False, functions_acl=functions_acl
            )
        )
        snuba_filter = resolve_snuba_aliases(snuba_filter, resolve_func)[0]
        if environment:
            snuba_filter.conditions.append(["environment", "=", environment.name])
        return snuba_filter

    def get_entity_extra_params(self) -> Mapping[str, Any]:
        return {"organization": self.org_id}

    def aggregate_query_results(
        self, data: List[Dict[str, Any]], alias: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        assert len(data) == 1
        col_name = alias if alias else CRASH_RATE_ALERT_AGGREGATE_ALIAS
        if data[0][col_name] is not None:
            data[0][col_name] = round((1 - data[0][col_name]) * 100, 3)
        else:
            metrics.incr(
                "incidents.entity_subscription.sessions.aggregate_query_results.no_session_data"
            )
        return data

    def build_snql_query(
        self,
        query: str,
        project_ids: Sequence[int],
        environment: Optional[Environment],
        params: Optional[MutableMapping[str, Any]] = None,
    ) -> Request:
        from sentry.search.events.builder import SessionsQueryBuilder

        aggregations = [self.aggregate]
        # This aggregation is added to return the total number of sessions in crash
        # rate alerts that is used to identify if we are below a general minimum alert threshold
        count_col = re.search(r"(sessions|users)", self.aggregate)
        if not count_col:
            raise UnsupportedQuerySubscription(
                "Only crash free percentage queries are supported for subscriptions"
                "over the sessions dataset"
            )
        count_col_matched = count_col.group()

        aggregations += [f"identity({count_col_matched}) AS {CRASH_RATE_ALERT_SESSION_COUNT_ALIAS}"]

        if params is None:
            params = {}

        params["project_id"] = project_ids

        if environment:
            params["environment"] = environment.name

        return SessionsQueryBuilder(
            dataset=Dataset(self.dataset.value),
            query=query,
            selected_columns=aggregations,
            params=params,
            offset=None,
            limit=None,
            functions_acl=["identity"],
            skip_time_conditions=True,
        ).get_snql_query()


class BaseMetricsEntitySubscription(BaseEntitySubscription, ABC):
    dataset = QueryDatasets.METRICS
    entity_key: EntityKey
    metric_key: SessionMRI

    def __init__(
        self, aggregate: str, time_window: int, extra_fields: Optional[_EntitySpecificParams] = None
    ):
        super().__init__(aggregate, time_window, extra_fields)
        self.aggregate = aggregate
        if not extra_fields or "org_id" not in extra_fields:
            raise InvalidQuerySubscription(
                "org_id is a required param when "
                "building snuba filter for a metrics subscription"
            )
        self.org_id = extra_fields["org_id"]
        self.session_status = resolve_tag_key(self.org_id, "session.status")
        self.time_window = time_window

    @abstractmethod
    def get_aggregations(self) -> List[List[Optional[str]]]:  # TODO: better type?
        raise NotImplementedError

    @abstractmethod
    def get_extra_conditions(self) -> List[List[Any]]:  # TODO: better type?
        raise NotImplementedError

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

    def build_snuba_filter(
        self,
        query: str,
        environment: Optional[Environment],
        params: Optional[Mapping[str, Any]] = None,
    ) -> Filter:
        snuba_filter = get_filter(query, params=params)
        conditions = copy(snuba_filter.conditions)
        snuba_filter.update_with(
            {
                "aggregations": self.get_aggregations(),
                "conditions": [
                    ["metric_id", "=", resolve(self.org_id, self.metric_key.value)],
                ]
                + self.get_extra_conditions(),
                "rollup": self.get_granularity(),
            }
        )
        if environment:
            snuba_filter.conditions.append(
                [
                    resolve_tag_key(self.org_id, "environment"),
                    "=",
                    resolve_weak(self.org_id, environment.name),
                ]
            )
        if query and len(conditions) > 0:
            release_conditions = [
                condition for condition in conditions if condition[0] == "release"
            ]

            for release_condition in release_conditions:
                snuba_filter.conditions.append(
                    [
                        resolve_tag_key(self.org_id, release_condition[0]),
                        release_condition[1],
                        resolve_weak(self.org_id, release_condition[2]),
                    ]
                )

        return snuba_filter

    def get_entity_extra_params(self) -> Mapping[str, Any]:
        return {
            "organization": self.org_id,
            "granularity": self.get_granularity(),
        }

    @staticmethod
    def translate_sessions_tag_keys_and_values(
        data: List[Dict[str, Any]], org_id: int, alias: Optional[str] = None
    ) -> Tuple[int, int]:
        value_col_name = alias if alias else "value"
        try:
            translated_data: Dict[str, Any] = {}
            session_status = resolve_tag_key(org_id, "session.status")
            for row in data:
                tag_value = reverse_resolve(row[session_status])
                translated_data[tag_value] = row[value_col_name]

            total_session_count = translated_data.get("init", 0)
            crash_count = translated_data.get("crashed", 0)
        except MetricIndexNotFound:
            metrics.incr("incidents.entity_subscription.metric_index_not_found")
            total_session_count = crash_count = 0
        return total_session_count, crash_count

    @staticmethod
    def is_crash_rate_format_v2(data: List[Dict[str, Any]]) -> bool:
        """Check if this is the new update format.
        This function can be removed once all subscriptions have been updated.
        """
        return bool(data) and "crashed" in data[0]

    def aggregate_query_results(
        self, data: List[Dict[str, Any]], alias: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Handle both update formats. Once all subscriptions have been updated
        to v2, we can remove v1 and replace this function with current v2.
        """
        if self.is_crash_rate_format_v2(data):
            version = "v2"
            result = self._aggregate_query_results_v2(data, alias)
        else:
            version = "v1"
            result = self._aggregate_query_results_v1(data, alias)

        metrics.incr(
            "incidents.entity_subscription.aggregate_query_results",
            tags={"format": version},
            sample_rate=1.0,
        )
        return result

    def _aggregate_query_results_v1(
        self, data: List[Dict[str, Any]], alias: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        aggregated_results: List[Dict[str, Any]]
        total_session_count, crash_count = self.translate_sessions_tag_keys_and_values(
            org_id=self.org_id, data=data, alias=alias
        )
        if total_session_count == 0:
            metrics.incr(
                "incidents.entity_subscription.metrics.aggregate_query_results.no_session_data"
            )
            crash_free_rate = None
        else:
            crash_free_rate = round((1 - crash_count / total_session_count) * 100, 3)

        col_name = alias if alias else CRASH_RATE_ALERT_AGGREGATE_ALIAS
        aggregated_results = [{col_name: crash_free_rate}]
        return aggregated_results

    def _aggregate_query_results_v2(
        self, data: List[Dict[str, Any]], alias: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        aggregated_results: List[Dict[str, Any]]
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

    def build_snql_query(
        self,
        query: str,
        project_ids: Sequence[int],
        environment: Optional[Environment],
        params: Optional[Mapping[str, Any]] = None,
    ) -> Request:
        raise NotImplementedError


class MetricsCountersEntitySubscription(BaseMetricsEntitySubscription):
    entity_key: EntityKey = EntityKey.MetricsCounters
    metric_key: SessionMRI = SessionMRI.SESSION

    def get_aggregations(self) -> List[List[Optional[str]]]:
        session_status_crashed = resolve(self.org_id, "crashed")
        session_status_init = resolve(self.org_id, "init")
        return [
            [
                f"sumIf(value, equals({self.session_status}, {session_status_init}))",
                None,
                "count",
            ],
            [
                f"sumIf(value, equals({self.session_status}, {session_status_crashed}))",
                None,
                "crashed",
            ],
        ]

    def get_extra_conditions(self) -> List[List[Any]]:
        crashed = resolve(self.org_id, "crashed")
        init = resolve(self.org_id, "init")
        return [[self.session_status, "IN", [crashed, init]]]


class MetricsSetsEntitySubscription(BaseMetricsEntitySubscription):
    entity_key: EntityKey = EntityKey.MetricsSets
    metric_key: SessionMRI = SessionMRI.USER

    def get_aggregations(self) -> List[List[Optional[str]]]:
        session_status_crashed = resolve(self.org_id, "crashed")
        return [
            [
                "uniq(value)",
                None,
                "count",
            ],
            [
                f"uniqIf(value, equals({self.session_status}, {session_status_crashed}))",
                None,
                "crashed",
            ],
        ]

    def get_extra_conditions(self) -> List[List[Any]]:
        return []


EntitySubscription = Union[
    EventsEntitySubscription,
    MetricsCountersEntitySubscription,
    MetricsSetsEntitySubscription,
    TransactionsEntitySubscription,
    SessionsEntitySubscription,
]
ENTITY_KEY_TO_ENTITY_SUBSCRIPTION: Mapping[EntityKey, Type[EntitySubscription]] = {
    EntityKey.Events: EventsEntitySubscription,
    EntityKey.MetricsCounters: MetricsCountersEntitySubscription,
    EntityKey.MetricsSets: MetricsSetsEntitySubscription,
    EntityKey.Sessions: SessionsEntitySubscription,
    EntityKey.Transactions: TransactionsEntitySubscription,
}


def get_entity_subscription_for_dataset(
    dataset: QueryDatasets,
    aggregate: str,
    time_window: int,
    extra_fields: Optional[_EntitySpecificParams] = None,
) -> EntitySubscription:
    """
    Function that routes to the correct instance of `EntitySubscription` based on the dataset,
    additionally does validation on aggregate for datasets like the sessions dataset and the
    metrics datasets then returns the instance of `EntitySubscription`
    """
    return ENTITY_KEY_TO_ENTITY_SUBSCRIPTION[map_aggregate_to_entity_key(dataset, aggregate)](
        aggregate, time_window, extra_fields
    )


def map_aggregate_to_entity_key(dataset: QueryDatasets, aggregate: str) -> Optional[EntityKey]:
    if dataset == QueryDatasets.EVENTS:
        entity_key = EntityKey.Events
    elif dataset == QueryDatasets.TRANSACTIONS:
        entity_key = EntityKey.Transactions
    elif dataset in [QueryDatasets.METRICS, QueryDatasets.SESSIONS]:
        match = re.match(CRASH_RATE_ALERT_AGGREGATE_RE, aggregate)
        if not match:
            raise UnsupportedQuerySubscription(
                f"Only crash free percentage queries are supported for subscriptions"
                f"over the {dataset.value} dataset"
            )
        if dataset == QueryDatasets.METRICS:
            count_col_matched = match.group(2)
            if count_col_matched == "sessions":
                entity_key = EntityKey.MetricsCounters
            else:
                entity_key = EntityKey.MetricsSets
        else:
            entity_key = EntityKey.Sessions
    else:
        raise UnsupportedQuerySubscription(
            f"{dataset} dataset does not have an entity key mapped to it"
        )
    return entity_key
