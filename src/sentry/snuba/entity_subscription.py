import re
from abc import ABC, abstractmethod
from copy import copy
from dataclasses import dataclass
from typing import Any, List, Mapping, Optional, TypedDict

from sentry.constants import CRASH_RATE_ALERT_SESSION_COUNT_ALIAS
from sentry.eventstore import Filter
from sentry.exceptions import InvalidQuerySubscription, UnsupportedQuerySubscription
from sentry.models import Environment
from sentry.release_health.metrics import get_tag_values_list, metric_id, tag_key, tag_value
from sentry.search.events.fields import resolve_field_list
from sentry.search.events.filter import get_filter
from sentry.sentry_metrics.sessions import SessionMetricKey
from sentry.snuba.dataset import EntityKey
from sentry.snuba.models import QueryDatasets, SnubaQueryEventType
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

    def __init__(self, aggregate: str, extra_fields: Optional[_EntitySpecificParams] = None):
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


class BaseEventsAndTransactionEntitySubscription(BaseEntitySubscription, ABC):
    def __init__(self, aggregate: str, extra_fields: Optional[_EntitySpecificParams] = None):
        super().__init__(aggregate, extra_fields)
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

    def get_entity_extra_params(self) -> Mapping[str, Any]:
        return {}


class EventsEntitySubscription(BaseEventsAndTransactionEntitySubscription):
    dataset = QueryDatasets.EVENTS
    entity_key = EntityKey.Events


class TransactionsEntitySubscription(BaseEventsAndTransactionEntitySubscription):
    dataset = QueryDatasets.TRANSACTIONS
    entity_key = EntityKey.Transactions


class SessionsEntitySubscription(BaseEntitySubscription):
    dataset = QueryDatasets.SESSIONS
    entity_key = EntityKey.Sessions

    def __init__(self, aggregate: str, extra_fields: Optional[_EntitySpecificParams] = None):
        super().__init__(aggregate, extra_fields)
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


class MetricsCountersEntitySubscription(BaseEntitySubscription):
    dataset = QueryDatasets.METRICS
    entity_key = EntityKey.MetricsCounters

    def __init__(self, aggregate: str, extra_fields: Optional[_EntitySpecificParams] = None):
        super().__init__(aggregate, extra_fields)
        self.aggregate = aggregate
        if not extra_fields or "org_id" not in extra_fields:
            raise InvalidQuerySubscription(
                "org_id is a required param when "
                "building snuba filter for a metrics subscription"
            )
        self.org_id = extra_fields["org_id"]
        self.session_status = tag_key(self.org_id, "session.status")

    def get_query_groupby(self) -> List[str]:
        return [self.session_status]

    def build_snuba_filter(
        self,
        query: str,
        environment: Optional[Environment],
        params: Optional[Mapping[str, Any]] = None,
    ) -> Filter:
        snuba_filter = get_filter(query, params=params)
        conditions = copy(snuba_filter.conditions)
        session_status_tag_values = get_tag_values_list(self.org_id, ["crashed", "init"])
        snuba_filter.update_with(
            {
                "aggregations": [["sum(value)", None, "value"]],
                "conditions": [
                    ["metric_id", "=", metric_id(self.org_id, SessionMetricKey.SESSION)],
                    [self.session_status, "IN", session_status_tag_values],
                ],
                "groupby": self.get_query_groupby(),
            }
        )
        if environment:
            snuba_filter.conditions.append(
                [tag_key(self.org_id, "environment"), "=", tag_value(self.org_id, environment.name)]
            )
        if query and len(conditions) > 0:
            release_conditions = [
                condition for condition in conditions if condition[0] == "release"
            ]

            for release_condition in release_conditions:
                snuba_filter.conditions.append(
                    [
                        tag_key(self.org_id, release_condition[0]),
                        release_condition[1],
                        tag_value(self.org_id, release_condition[2]),
                    ]
                )

        return snuba_filter

    def get_entity_extra_params(self) -> Mapping[str, Any]:
        return {"organization": self.org_id, "groupby": self.get_query_groupby()}


def map_aggregate_to_entity_subscription(
    dataset: QueryDatasets, aggregate: str, extra_fields: Optional[_EntitySpecificParams] = None
) -> BaseEntitySubscription:
    """
    Function that routes to the correct instance of `EntitySubscription` based on the dataset,
    additionally does validation on aggregate for datasets like the sessions dataset and the
    metrics datasets then returns the instance of `EntitySubscription`
    """
    entity_subscription: BaseEntitySubscription
    if dataset == QueryDatasets.SESSIONS:
        match = re.match(CRASH_RATE_ALERT_AGGREGATE_RE, aggregate)
        if not match:
            raise UnsupportedQuerySubscription(
                "Only crash free percentage queries are supported for subscriptions"
                "over the sessions dataset"
            )
        entity_subscription = SessionsEntitySubscription(aggregate, extra_fields)
    elif dataset == QueryDatasets.TRANSACTIONS:
        entity_subscription = TransactionsEntitySubscription(aggregate, extra_fields)
    elif dataset == QueryDatasets.METRICS:
        match = re.match(CRASH_RATE_ALERT_AGGREGATE_RE, aggregate)
        if not match:
            raise UnsupportedQuerySubscription(
                "Only crash free percentage queries are supported for subscriptions"
                "over the metrics dataset"
            )

        count_col_matched = match.group(2)
        if count_col_matched == "sessions":
            entity_subscription = MetricsCountersEntitySubscription(aggregate, extra_fields)
        else:
            raise UnsupportedQuerySubscription(
                "Crash Free Users subscriptions are not supported yet"
            )
    else:
        entity_subscription = EventsEntitySubscription(aggregate, extra_fields)
    return entity_subscription
