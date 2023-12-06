import logging
import random
from copy import copy, deepcopy
from datetime import datetime, timedelta
from typing import Any, Mapping, Optional, Sequence

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
    OrderBy,
    Query,
    Request,
)

from sentry.eventstore.base import EventStorage
from sentry.eventstore.models import Event
from sentry.models.group import Group
from sentry.snuba.dataset import Dataset
from sentry.snuba.events import Columns
from sentry.utils import snuba
from sentry.utils.snuba import DATASETS, _prepare_start_end, raw_snql_query
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


def get_before_event_condition(event):
    return [
        [TIMESTAMP, "<=", event.datetime],
        [[TIMESTAMP, "<", event.datetime], [EVENT_ID, "<", event.event_id]],
    ]


def get_after_event_condition(event):
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
        start: Optional[datetime],
        end: Optional[datetime],
        conditions: Sequence[Condition],
        orderby: Sequence[str],
        limit=DEFAULT_LIMIT,
        offset=DEFAULT_OFFSET,
        referrer="eventstore.get_events_snql",
        dataset=Dataset.Events,
        tenant_ids=None,
    ):
        cols = self.__get_columns(dataset)

        resolved_order_by = []
        for order_field_alias in orderby:
            if order_field_alias.startswith("-"):
                direction = Direction.DESC
                order_field_alias = order_field_alias[1:]
            else:
                direction = Direction.ASC
            resolved_column_or_none = DATASETS[dataset].get(order_field_alias)
            if resolved_column_or_none:
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
                                "if", [Function("isNull", [Column(resolved_column_or_none)]), 0, 1]
                            ),
                            direction=direction,
                        )
                    )
                else:
                    resolved_order_by.append(
                        OrderBy(Column(resolved_column_or_none), direction=direction)
                    )
        orderby = resolved_order_by

        start, end = _prepare_start_end(
            start,
            end,
            organization_id,
            [group_id],
        )

        snql_request = Request(
            dataset=dataset.value,
            app_id="eventstore",
            query=Query(
                match=Entity(dataset.value),
                select=[Column(col) for col in cols],
                where=[
                    Condition(
                        Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]), Op.GTE, start
                    ),
                    Condition(Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]), Op.LT, end),
                ]
                + list(conditions),
                orderby=orderby,
                limit=Limit(limit),
                offset=Offset(offset),
            ),
            tenant_ids=tenant_ids or dict(),
        )

        result = raw_snql_query(snql_request, referrer, use_cache=False)

        if "error" not in result:
            events = [self.__make_event(evt) for evt in result["data"]]
            self.bind_nodes(events)
            return events

        return []

    def get_events(
        self,
        filter,
        orderby=None,
        limit=DEFAULT_LIMIT,
        offset=DEFAULT_OFFSET,
        referrer="eventstore.get_events",
        dataset=Dataset.Events,
        tenant_ids=None,
    ):
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
        filter,
        orderby=None,
        limit=DEFAULT_LIMIT,
        offset=DEFAULT_OFFSET,
        referrer="eventstore.get_unfetched_events",
        dataset=Dataset.Events,
        tenant_ids=None,
    ):
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
        filter,
        orderby=None,
        limit=DEFAULT_LIMIT,
        offset=DEFAULT_OFFSET,
        referrer=None,
        should_bind_nodes=False,
        dataset=Dataset.Events,
        tenant_ids=None,
    ):
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

            nodestore_events = [event for event in event_list if len(event.data)]

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

    def get_event_by_id(
        self,
        project_id,
        event_id,
        group_id=None,
        skip_transaction_groupevent=False,
        tenant_ids=None,
        occurrence_id: Optional[str] = None,
    ):
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
                    ["timestamp", ">", datetime.fromtimestamp(random.randint(0, 1000000000))]
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

    def _get_dataset_for_event(self, event):
        if getattr(event, "occurrence", None) or event.get_event_type() == "generic":
            return Dataset.IssuePlatform
        elif event.get_event_type() == "transaction":
            return Dataset.Transactions
        else:
            return Dataset.Discover

    def get_adjacent_event_ids(self, event, filter):
        """
        Returns (project_id, event_id) of a previous event given a current event
        and a filter. Returns None if no previous event is found.
        """
        assert filter, "You must provide a filter"

        if not event:
            return (None, None)

        prev_filter = deepcopy(filter)
        prev_filter.conditions = prev_filter.conditions or []
        prev_filter.conditions.extend(get_before_event_condition(event))
        prev_filter.start = datetime.utcfromtimestamp(0)
        # the previous event can have the same timestamp, add 1 second
        # to the end condition since it uses a less than condition
        prev_filter.end = event.datetime + timedelta(seconds=1)
        prev_filter.orderby = DESC_ORDERING

        next_filter = deepcopy(filter)
        next_filter.conditions = next_filter.conditions or []
        next_filter.conditions.extend(get_after_event_condition(event))
        next_filter.start = event.datetime
        next_filter.end = datetime.utcnow()
        next_filter.orderby = ASC_ORDERING

        dataset = self._get_dataset_for_event(event)
        return self.__get_event_ids_from_filters(
            filters=(prev_filter, next_filter),
            dataset=dataset,
            tenant_ids={"organization_id": event.project.organization_id},
        )

    def __get_columns(self, dataset: Dataset):
        return [col.value.event_name for col in EventStorage.minimal_columns[dataset]]

    def __get_event_ids_from_filters(self, filters=(), dataset=Dataset.Discover, tenant_ids=None):
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

    def __get_event_id_from_result(self, result: Mapping[str, Any]):
        if "error" in result or len(result["data"]) == 0:
            return None

        row = result["data"][0]
        return (str(row["project_id"]), str(row["event_id"]))

    def __make_event(self, snuba_data):
        event_id = snuba_data[Columns.EVENT_ID.value.event_name]
        project_id = snuba_data[Columns.PROJECT_ID.value.event_name]

        return Event(event_id=event_id, project_id=project_id, snuba_data=snuba_data)

    def get_unfetched_transactions(
        self,
        filter,
        orderby=None,
        limit=DEFAULT_LIMIT,
        offset=DEFAULT_OFFSET,
        referrer="eventstore.get_unfetched_transactions",
        tenant_ids=None,
    ):
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

    def __make_transaction(self, snuba_data):
        event_id = snuba_data[Columns.EVENT_ID.value.event_name]
        project_id = snuba_data[Columns.PROJECT_ID.value.event_name]

        return Event(event_id=event_id, project_id=project_id, snuba_data=snuba_data)
