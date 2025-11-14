from __future__ import annotations

import logging
import random
from collections.abc import Mapping, Sequence
from copy import copy, deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, overload, int

import sentry_sdk
from django.utils import timezone
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Limit,
    Offset,
    Op,
    Or,
    OrderBy,
    Query,
    Request,
)

from sentry.models.group import Group
from sentry.services.eventstore.base import EventStorage, Filter
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.snuba.dataset import Dataset
from sentry.snuba.events import Columns
from sentry.utils import snuba
from sentry.utils.snuba import DATASETS, _prepare_start_end, bulk_snuba_queries, raw_snql_query
from sentry.utils.validators import normalize_event_id

EVENT_ID = Columns.EVENT_ID.value.alias
PROJECT_ID = Columns.PROJECT_ID.value.alias
TIMESTAMP = Columns.TIMESTAMP.value.alias

DESC_ORDERING = [f"-{TIMESTAMP}", f"-{EVENT_ID}"]
ASC_ORDERING = [TIMESTAMP, EVENT_ID]
DEFAULT_LIMIT = 100
DEFAULT_OFFSET = 0

NODESTORE_LIMIT = 100

logger = logging.getLogger(__name__)


def get_before_event_condition(event: Event | GroupEvent) -> list[list[Any]]:
    return [
        [TIMESTAMP, "<=", event.datetime],
        [[TIMESTAMP, "<", event.datetime], [EVENT_ID, "<", event.event_id]],
    ]


def get_after_event_condition(event: Event | GroupEvent) -> list[list[Any]]:
    return [
        [TIMESTAMP, ">=", event.datetime],
        [[TIMESTAMP, ">", event.datetime], [EVENT_ID, ">", event.event_id]],
    ]


class SnubaEventStorage(EventStorage):
    """
    Eventstore backend backed by Snuba
    """

    def get_events_snql(
        self,
        organization_id: int,
        group_id: int,
        start: datetime | None,
        end: datetime | None,
        conditions: Sequence[Condition],
        orderby: Sequence[str],
        limit: int = DEFAULT_LIMIT,
        inner_limit: int | None = None,
        offset: int = DEFAULT_OFFSET,
        referrer: str = "eventstore.get_events_snql",
        dataset: Dataset = Dataset.Events,
        tenant_ids: Mapping[str, Any] | None = None,
    ) -> list[Event]:
        cols = self.__get_columns(dataset)

        resolved_order_by = []
        order_by_col_names: set[str] = set()
        for order_field_alias in orderby:
            if order_field_alias.startswith("-"):
                direction = Direction.DESC
                order_field_alias = order_field_alias[1:]
            else:
                direction = Direction.ASC
            resolved_column_or_none = DATASETS[dataset].get(order_field_alias)
            if resolved_column_or_none:
                order_by_col_names.add(resolved_column_or_none)
                # special-case handling for nullable column values and proper ordering based on direction
                # null values are always last in the sort order regardless of Desc or Asc ordering
                if order_field_alias == Columns.NUM_PROCESSING_ERRORS.value.alias:
                    resolved_order_by.append(
                        OrderBy(
                            Function("coalesce", [Column(resolved_column_or_none), 99999999]),
                            direction=direction,
                        )
                    )
                elif order_field_alias == Columns.TRACE_SAMPLED.value.alias:
                    resolved_order_by.append(
                        OrderBy(
                            Function("coalesce", [Column(resolved_column_or_none), -1]),
                            direction=direction,
                        )
                    )
                elif order_field_alias in (
                    Columns.PROFILE_ID.value.alias,
                    Columns.REPLAY_ID.value.alias,
                ):
                    resolved_order_by.append(
                        OrderBy(
                            Function(
                                "if",
                                [
                                    Function("isNull", [Column(resolved_column_or_none)]),
                                    0,
                                    1,
                                ],
                            ),
                            direction=direction,
                        )
                    )
                elif order_field_alias == Columns.TIMESTAMP.value.alias:
                    resolved_order_by.extend(
                        [
                            OrderBy(
                                Function("toStartOfDay", [Column("timestamp")]),
                                direction=direction,
                            ),
                            OrderBy(
                                Column("timestamp"),
                                direction=direction,
                            ),
                        ]
                    )
                else:
                    resolved_order_by.append(
                        OrderBy(Column(resolved_column_or_none), direction=direction)
                    )

        start, end = _prepare_start_end(
            start,
            end,
            organization_id,
            [group_id],
        )

        match_entity = Entity(dataset.value)
        event_filters = [
            Condition(Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]), Op.GTE, start),
            Condition(Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]), Op.LT, end),
        ] + list(conditions)

        common_request_kwargs = {
            "app_id": "eventstore",
            "dataset": dataset.value,
            "tenant_ids": tenant_ids or dict(),
        }

        common_query_kwargs = {
            "select": [Column(col) for col in cols],
            "orderby": resolved_order_by,
            "limit": Limit(limit),
            "offset": Offset(offset),
        }

        # If inner_limit provided, first limit to the most recent N rows, then apply final ordering
        # and pagination on top of that subquery.
        if inner_limit and inner_limit > 0:
            select_and_orderby_cols = set(cols) | order_by_col_names
            inner_query = Query(
                match=match_entity,
                select=[Column(col) for col in select_and_orderby_cols],
                where=event_filters,
                orderby=[
                    OrderBy(
                        Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]),
                        direction=Direction.DESC,
                    ),
                    OrderBy(
                        Column(DATASETS[dataset][Columns.EVENT_ID.value.alias]),
                        direction=Direction.DESC,
                    ),
                ],
                limit=Limit(inner_limit),
            )

            outer_query = Query(
                **common_query_kwargs,
                match=inner_query,
            )

            snql_request = Request(**common_request_kwargs, query=outer_query)
        else:
            snql_request = Request(
                **common_request_kwargs,
                query=Query(
                    **common_query_kwargs,
                    match=match_entity,
                    where=event_filters,
                ),
            )

        result = raw_snql_query(snql_request, referrer, use_cache=False)

        if "error" not in result:
            events = [self.__make_event(evt) for evt in result["data"]]
            self.bind_nodes(events)
            return events

        return []

    def get_events(
        self,
        filter: Filter,
        orderby: Sequence[str] | None = None,
        limit: int = DEFAULT_LIMIT,
        offset: int = DEFAULT_OFFSET,
        referrer: str = "eventstore.get_events",
        dataset: Dataset = Dataset.Events,
        tenant_ids: Mapping[str, Any] | None = None,
    ) -> list[Event]:
        """
        Get events from Snuba, with node data loaded.
        """
        with sentry_sdk.start_span(op="eventstore.snuba.get_events"):
            return self.__get_events(
                filter,
                orderby=orderby,
                limit=limit,
                offset=offset,
                referrer=referrer,
                should_bind_nodes=True,
                dataset=dataset,
                tenant_ids=tenant_ids,
            )

    def get_unfetched_events(
        self,
        filter: Filter,
        orderby: Sequence[str] | None = None,
        limit: int = DEFAULT_LIMIT,
        offset: int = DEFAULT_OFFSET,
        referrer: str = "eventstore.get_unfetched_events",
        dataset: Dataset = Dataset.Events,
        tenant_ids: Mapping[str, Any] | None = None,
    ) -> list[Event]:
        """
        Get events from Snuba, without node data loaded.
        """
        return self.__get_events(
            filter,
            orderby=orderby,
            limit=limit,
            offset=offset,
            referrer=referrer,
            should_bind_nodes=False,
            dataset=dataset,
            tenant_ids=tenant_ids,
        )

    def __get_events(
        self,
        filter: Filter,
        orderby: Sequence[str] | None = None,
        limit: int = DEFAULT_LIMIT,
        offset: int = DEFAULT_OFFSET,
        referrer: str = "eventstore.get_unfetched_events",
        should_bind_nodes: bool = False,
        dataset: Dataset = Dataset.Events,
        tenant_ids: Mapping[str, Any] | None = None,
    ) -> list[Event]:
        assert filter, "You must provide a filter"
        cols = self.__get_columns(dataset)
        orderby = orderby or DESC_ORDERING

        # This is an optimization for the Group.filter_by_event_id query where we
        # have a single event ID and want to check all accessible projects for a
        # direct hit. In this case it's usually faster to go to nodestore first.
        if (
            filter.event_ids
            and filter.project_ids
            and len(filter.event_ids) * len(filter.project_ids) < min(limit, NODESTORE_LIMIT)
            and offset == 0
            and should_bind_nodes
        ):
            event_list = [
                Event(project_id=project_id, event_id=event_id)
                for event_id in filter.event_ids
                for project_id in filter.project_ids
            ]
            self.bind_nodes(event_list)

            # Extending date filters by +- 1s since events are second-resolution.
            start = filter.start - timedelta(seconds=1) if filter.start else datetime(1970, 1, 1)
            end = filter.end + timedelta(seconds=1) if filter.end else timezone.now()
            start, end = start.replace(tzinfo=UTC), end.replace(tzinfo=UTC)

            nodestore_events = [
                event
                for event in event_list
                if len(event.data) and start <= event.datetime.replace(tzinfo=UTC) <= end
            ]

            if nodestore_events:
                event_ids = {event.event_id for event in nodestore_events}
                project_ids = {event.project_id for event in nodestore_events}
                start = min(event.datetime for event in nodestore_events)
                end = max(event.datetime for event in nodestore_events) + timedelta(seconds=1)

                result = snuba.aliased_query(
                    selected_columns=cols,
                    start=start,
                    end=end,
                    conditions=filter.conditions,
                    filter_keys={"project_id": project_ids, "event_id": event_ids},
                    orderby=orderby,
                    limit=len(nodestore_events),
                    offset=DEFAULT_OFFSET,
                    referrer=referrer,
                    dataset=dataset,
                    tenant_ids=tenant_ids,
                )

                if "error" not in result:
                    events = [self.__make_event(evt) for evt in result["data"]]

                    # Bind previously fetched node data
                    nodestore_dict = {
                        (e.event_id, e.project_id): e.data.data for e in nodestore_events
                    }
                    for event in events:
                        node_data = nodestore_dict[(event.event_id, event.project_id)]
                        event.data.bind_data(node_data)
                    return events

            return []

        result = snuba.aliased_query(
            selected_columns=cols,
            start=filter.start,
            end=filter.end,
            conditions=filter.conditions,
            filter_keys=filter.filter_keys,
            orderby=orderby,
            limit=limit,
            offset=offset,
            referrer=referrer,
            dataset=dataset,
            tenant_ids=tenant_ids,
        )

        if "error" not in result:
            events = [self.__make_event(evt) for evt in result["data"]]
            if should_bind_nodes:
                self.bind_nodes(events)
            return events

        return []

    @overload
    def get_event_by_id(
        self,
        project_id: int,
        event_id: str,
        group_id: int | None = None,
        tenant_ids: Mapping[str, Any] | None = None,
        occurrence_id: str | None = None,
        *,
        skip_transaction_groupevent: Literal[True],
    ) -> Event | None: ...

    @overload
    def get_event_by_id(
        self,
        project_id: int,
        event_id: str,
        group_id: int | None = None,
        tenant_ids: Mapping[str, Any] | None = None,
        occurrence_id: str | None = None,
        *,
        skip_transaction_groupevent: bool = False,
    ) -> Event | GroupEvent | None: ...

    def get_event_by_id(
        self,
        project_id: int,
        event_id: str,
        group_id: int | None = None,
        tenant_ids: Mapping[str, Any] | None = None,
        occurrence_id: str | None = None,
        *,
        skip_transaction_groupevent: bool = False,
    ) -> Event | GroupEvent | None:
        """
        Get an event given a project ID and event ID
        Returns None if an event cannot be found

        skip_transaction_groupevent: Temporary hack parameter to skip converting a transaction
        event into a `GroupEvent`. Used as part of `post_process_group`.
        """

        event_id = normalize_event_id(event_id)

        if not event_id:
            return None

        event = Event(project_id=project_id, event_id=event_id)

        # Return None if there was no data in nodestore
        if len(event.data) == 0:
            return None

        if group_id is not None:
            sentry_sdk.set_tag("nodestore.event_type", event.get_event_type())

        if group_id is not None and (
            event.get_event_type() == "error"
            or (event.get_event_type() == "transaction" and skip_transaction_groupevent)
        ):
            event.group_id = group_id
        elif occurrence_id is not None and group_id is not None:
            event.group_id = group_id

            event._snuba_data = {
                "event_id": event_id,
                "group_id": group_id,
                "project_id": project_id,
                "timestamp": event.timestamp,
                "occurrence_id": occurrence_id,
            }

        elif event.get_event_type() != "transaction" or group_id:
            # Load group_id from Snuba if not a transaction
            raw_query_kwargs = {}
            if event.datetime > timezone.now() - timedelta(hours=1):
                # XXX: This is a hack to bust the snuba cache. We want to avoid the case where
                # we cache an empty result, since this can result in us failing to fetch new events
                # in some cases.
                raw_query_kwargs["conditions"] = [
                    [
                        "timestamp",
                        ">",
                        datetime.fromtimestamp(random.randint(0, 1000000000)),
                    ]
                ]
            dataset = (
                Dataset.IssuePlatform
                if event.get_event_type() in ("transaction", "generic")
                else Dataset.Events
            )
            try:
                tenant_ids = tenant_ids or {"organization_id": event.project.organization_id}
                filter_keys = {"project_id": [project_id], "event_id": [event_id]}
                if group_id:
                    filter_keys["group_id"] = [group_id]
                result = snuba.raw_query(
                    dataset=dataset,
                    selected_columns=self.__get_columns(dataset),
                    start=event.datetime,
                    end=event.datetime + timedelta(seconds=1),
                    filter_keys=filter_keys,
                    limit=1,
                    referrer="eventstore.backend.get_event_by_id_nodestore",
                    tenant_ids=tenant_ids,
                    **raw_query_kwargs,
                )
            except snuba.QueryOutsideRetentionError:
                # this can happen due to races.  We silently want to hide
                # this from callers.
                return None

            # Return None if the event from Nodestore was not yet written to Snuba
            if len(result["data"]) != 1:
                logger.warning(
                    "eventstore.missing-snuba-event",
                    extra={
                        "project_id": project_id,
                        "event_id": event_id,
                        "group_id": group_id,
                        "event_datetime": event.datetime,
                        "event_timestamp": event.timestamp,
                        "nodestore_insert": event.data.get("nodestore_insert"),
                        "received": event.data.get("received"),
                        "len_data": len(result["data"]),
                    },
                )
                return None

            event.group_id = result["data"][0]["group_id"]
            # Inject the snuba data here to make sure any snuba columns are available
            event._snuba_data = result["data"][0]

        # Set passed group_id if not a transaction
        if event.get_event_type() == "transaction" and not skip_transaction_groupevent and group_id:
            logger.warning("eventstore.passed-group-id-for-transaction")
            return event.for_group(Group.objects.get(id=group_id))

        return event

    def _get_dataset_for_event(self, event: Event | GroupEvent) -> Dataset:
        if getattr(event, "occurrence", None) or event.get_event_type() == "generic":
            return Dataset.IssuePlatform
        elif event.get_event_type() == "transaction":
            return Dataset.Transactions
        else:
            return Dataset.Discover

    def get_adjacent_event_ids_snql(
        self,
        organization_id: int,
        project_id: int,
        group_id: int | None,
        environments: Sequence[str],
        event: Event | GroupEvent,
        start: datetime | None = None,
        end: datetime | None = None,
        conditions: list[Any] | None = None,
    ) -> list[tuple[str, str] | None]:
        """
        Utility function for grabbing an event's adjacent events,
        which are the ones with the closest timestamps before and after.
        This function is only used in project_event_details at the moment,
        so it's interface is tailored to that. We use SnQL and use the project_id
        and toStartOfDay(timestamp) to efficiently scan our table
        """
        dataset = self._get_dataset_for_event(event)
        app_id = "eventstore"
        referrer = "eventstore.get_next_or_prev_event_id_snql"
        tenant_ids = {"organization_id": organization_id}
        if not conditions:
            conditions = []

        def make_constant_conditions() -> list[Condition | Or]:
            environment_conditions = []
            if environments:
                environment_conditions.append(Condition(Column("environment"), Op.IN, environments))

            group_conditions = []
            if group_id:
                group_conditions.append(Condition(Column("group_id"), Op.EQ, group_id))
            project_conditions = [Condition(Column("project_id"), Op.EQ, project_id)]
            return [
                *conditions,
                *environment_conditions,
                *group_conditions,
                *project_conditions,
            ]

        lower_bound = start or (event.datetime - timedelta(days=100))
        upper_bound = end or (event.datetime + timedelta(days=100))

        def make_prev_timestamp_conditions(
            event: Event | GroupEvent,
        ) -> list[Condition | Or]:
            return [
                Condition(
                    Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]),
                    Op.GTE,
                    lower_bound,
                ),
                Condition(
                    Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]),
                    Op.LT,
                    event.datetime + timedelta(seconds=1),
                ),
                Or(
                    conditions=[
                        Condition(
                            Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]),
                            Op.LT,
                            event.datetime,
                        ),
                        Condition(Column("event_id"), Op.LT, event.event_id),
                    ],
                ),
            ]

        def make_next_timestamp_conditions(
            event: Event | GroupEvent,
        ) -> list[Condition | Or]:
            return [
                Condition(
                    Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]),
                    Op.LT,
                    upper_bound,
                ),
                Condition(
                    Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]),
                    Op.GTE,
                    event.datetime,
                ),
                Or(
                    conditions=[
                        Condition(Column("event_id"), Op.GT, event.event_id),
                        Condition(
                            Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]),
                            Op.GT,
                            event.datetime,
                        ),
                    ],
                ),
            ]

        def make_request(is_prev: bool) -> Request:
            order_by_direction = Direction.DESC if is_prev else Direction.ASC
            conditions = make_constant_conditions()
            conditions.extend(
                make_prev_timestamp_conditions(event)
                if is_prev
                else make_next_timestamp_conditions(event)
            )
            return Request(
                dataset=dataset.value,
                app_id=app_id,
                query=Query(
                    match=Entity(dataset.value),
                    select=[Column("event_id"), Column("project_id")],
                    where=conditions,
                    orderby=[
                        OrderBy(
                            Column("project_id"),
                            direction=order_by_direction,
                        ),
                        OrderBy(
                            Function("toStartOfDay", [Column("timestamp")]),
                            direction=order_by_direction,
                        ),
                        OrderBy(
                            Column("timestamp"),
                            direction=order_by_direction,
                        ),
                        OrderBy(
                            Column("event_id"),
                            direction=order_by_direction,
                        ),
                    ],
                    limit=Limit(1),
                ),
                tenant_ids=tenant_ids,
            )

        snql_request_prev = make_request(is_prev=True)
        snql_request_next = make_request(is_prev=False)

        bulk_snql_results = bulk_snuba_queries(
            [snql_request_prev, snql_request_next], referrer=referrer
        )
        event_ids = [self.__get_event_id_from_result(result) for result in bulk_snql_results]
        return event_ids

    def get_adjacent_event_ids(
        self, event: Event | GroupEvent | None, filter: Filter
    ) -> tuple[tuple[str, str] | None, tuple[str, str] | None]:
        """
        Returns (project_id, event_id) of a previous event given a current event
        and a filter. Returns None if no previous event is found.
        """
        assert filter, "You must provide a filter"

        if event is None:
            return (None, None)

        prev_filter = deepcopy(filter)
        prev_filter.conditions = prev_filter.conditions or []
        prev_filter.conditions.extend(get_before_event_condition(event))
        if not prev_filter.start:
            # We only store 90 days of data, add a few extra days just in case
            prev_filter.start = event.datetime - timedelta(days=100)
        # the previous event can have the same timestamp, add 1 second
        # to the end condition since it uses a less than condition
        prev_filter.end = event.datetime + timedelta(seconds=1)
        prev_filter.orderby = DESC_ORDERING

        next_filter = deepcopy(filter)
        next_filter.conditions = next_filter.conditions or []
        next_filter.conditions.extend(get_after_event_condition(event))
        next_filter.start = event.datetime
        if not next_filter.end:
            next_filter.end = datetime.utcnow()
        next_filter.orderby = ASC_ORDERING

        dataset = self._get_dataset_for_event(event)
        result = self.__get_event_ids_from_filters(
            filters=(prev_filter, next_filter),
            dataset=dataset,
            tenant_ids={"organization_id": event.project.organization_id},
        )
        return result[0], result[1]

    def __get_columns(self, dataset: Dataset) -> list[str]:
        return [
            col.value.event_name
            for col in EventStorage.minimal_columns[dataset]
            if col.value.event_name is not None
        ]

    def __get_event_ids_from_filters(
        self,
        filters: tuple[Filter, Filter],
        dataset: Dataset = Dataset.Discover,
        tenant_ids: Mapping[str, Any] | None = None,
    ) -> list[tuple[str, str] | None]:
        columns = [Columns.EVENT_ID.value.alias, Columns.PROJECT_ID.value.alias]
        try:
            # This query uses the discover dataset to enable
            # getting events across both errors and transactions, which is
            # required when doing pagination in discover
            results = snuba.bulk_raw_query(
                [
                    snuba.SnubaQueryParams(
                        **snuba.aliased_query_params(
                            selected_columns=copy(columns),
                            conditions=filter.conditions,
                            filter_keys=filter.filter_keys,
                            start=filter.start,
                            end=filter.end,
                            orderby=filter.orderby,
                            limit=1,
                            referrer="eventstore.get_next_or_prev_event_id",
                            dataset=dataset,
                            tenant_ids=tenant_ids,
                        )
                    )
                    for filter in filters
                ],
                referrer="eventstore.get_next_or_prev_event_id",
            )
        except (snuba.QueryOutsideRetentionError, snuba.QueryOutsideGroupActivityError):
            # This can happen when the date conditions for paging
            # and the current event generate impossible conditions.
            return [None for _ in filters]

        return [self.__get_event_id_from_result(result) for result in results]

    def __get_event_id_from_result(self, result: Mapping[str, Any]) -> tuple[str, str] | None:
        if "error" in result or len(result["data"]) == 0:
            return None

        row = result["data"][0]
        return (str(row["project_id"]), str(row["event_id"]))

    def __make_event(self, snuba_data: Mapping[str, Any]) -> Event:
        event_id_column = Columns.EVENT_ID.value.event_name
        project_id_column = Columns.PROJECT_ID.value.event_name

        if event_id_column is None or project_id_column is None:
            raise ValueError("Event ID or Project ID column name is None")

        event_id = snuba_data[event_id_column]
        project_id = snuba_data[project_id_column]

        return Event(event_id=event_id, project_id=project_id, snuba_data=snuba_data)

    def get_unfetched_transactions(
        self,
        filter: Filter,
        orderby: Sequence[str] | None = None,
        limit: int = DEFAULT_LIMIT,
        offset: int = DEFAULT_OFFSET,
        referrer: str = "eventstore.get_unfetched_transactions",
        tenant_ids: Mapping[str, Any] | None = None,
    ) -> list[Event]:
        """
        Get transactions from Snuba, without node data loaded.
        """
        assert filter, "You must provide a filter"
        cols = self.__get_columns(Dataset.Transactions)
        orderby = orderby or DESC_ORDERING

        result = snuba.aliased_query(
            selected_columns=cols,
            start=filter.start,
            end=filter.end,
            conditions=filter.conditions,
            filter_keys=filter.filter_keys,
            orderby=orderby,
            limit=limit,
            offset=offset,
            referrer=referrer,
            dataset=Dataset.Transactions,
            tenant_ids=tenant_ids,
        )

        if "error" not in result:
            events = [self.__make_transaction(evt) for evt in result["data"]]
            return events

        return []

    def __make_transaction(self, snuba_data: Mapping[str, Any]) -> Event:
        event_id_column = Columns.EVENT_ID.value.event_name
        project_id_column = Columns.PROJECT_ID.value.event_name

        if event_id_column is None or project_id_column is None:
            raise ValueError("Event ID or Project ID column name is None")

        event_id = snuba_data[event_id_column]
        project_id = snuba_data[project_id_column]

        return Event(event_id=event_id, project_id=project_id, snuba_data=snuba_data)
