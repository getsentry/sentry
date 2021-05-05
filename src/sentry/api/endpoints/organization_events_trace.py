import logging
from collections import OrderedDict, defaultdict, deque
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Deque,
    Dict,
    Iterable,
    List,
    Mapping,
    Optional,
    Sequence,
    Set,
    Tuple,
    TypeVar,
    cast,
)

import sentry_sdk
from django.http import Http404, HttpRequest, HttpResponse
from rest_framework.exceptions import ParseError
from rest_framework.response import Response
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME

from sentry import eventstore, features
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.serializers.models.event import get_tags_with_meta
from sentry.eventstore.models import Event
from sentry.models import Organization
from sentry.snuba import discover
from sentry.utils.snuba import Dataset, SnubaQueryParams, bulk_raw_query
from sentry.utils.validators import INVALID_EVENT_DETAILS, is_event_id

logger: logging.Logger = logging.getLogger(__name__)
MAX_TRACE_SIZE: int = 100

# TODO(3.8): This is a hack so we can get TypedDicts before 3.8
if TYPE_CHECKING:
    from mypy_extensions import TypedDict
else:

    def TypedDict(*args, **kwargs):
        pass


_T = TypeVar("_T")
NodeSpans = List[Dict[str, Any]]
SnubaTransaction = TypedDict(
    "SnubaTransaction",
    {
        "id": str,
        "transaction.status": int,
        "transaction.op": str,
        "transaction.duration": int,
        "transaction": str,
        "timestamp": str,
        "trace.span": str,
        "trace.parent_span": str,
        "root": str,
        "project.id": int,
        "project": str,
    },
)
SnubaError = TypedDict(
    "SnubaError",
    {
        "id": str,
        "timestamp": str,
        "trace.span": str,
        "transaction": str,
        "issue.id": int,
        "title": str,
        "tags[level]": str,
        "project.id": int,
        "project": str,
    },
)
TraceError = TypedDict(
    "TraceError",
    {
        "event_id": str,
        "issue_id": int,
        "span": str,
        "project_id": int,
        "project_slug": str,
        "title": str,
        "level": str,
    },
)
LightResponse = TypedDict(
    "LightResponse",
    {
        "event_id": str,
        "span_id": str,
        "transaction": str,
        "transaction.duration": int,
        "transaction.op": str,
        "project_id": int,
        "project_slug": str,
        "parent_span_id": Optional[str],
        "parent_event_id": Optional[str],
        "generation": Optional[int],
        "errors": List[TraceError],
    },
)
FullResponse = TypedDict(
    "FullResponse",
    {
        "event_id": str,
        "span_id": str,
        "transaction": str,
        "transaction.duration": int,
        "transaction.op": str,
        "project_id": int,
        "project_slug": str,
        "parent_span_id": Optional[str],
        "parent_event_id": Optional[str],
        "generation": Optional[int],
        "errors": List[TraceError],
        "timestamp": str,
        "start_timestamp": str,
        # Any because children are more FullResponse objects
        "children": List[Any],
        # Only on the detailed response
        "measurements": Dict[str, int],
        "tags": List[Tuple[str, str]],
        "_meta": Dict[str, Any],
        "transaction.status": str,
    },
)


class TraceEvent:
    def __init__(
        self, event: SnubaTransaction, parent: Optional[str], generation: Optional[int]
    ) -> None:
        self.event: SnubaTransaction = event
        self.errors: List[TraceError] = []
        self.children: List[TraceEvent] = []

        # Can be None on the light trace when we don't know the parent
        self.parent_event_id: Optional[str] = parent
        self.generation: Optional[int] = generation

        # Added as required because getting the nodestore_event is expensive
        self.nodestore_event: Optional[Event] = None

    def to_dict(self) -> LightResponse:
        return {
            "event_id": self.event["id"],
            "span_id": self.event["trace.span"],
            "transaction": self.event["transaction"],
            "transaction.duration": self.event["transaction.duration"],
            "transaction.op": self.event["transaction.op"],
            "project_id": self.event["project.id"],
            "project_slug": self.event["project"],
            # Avoid empty string for root self.events
            "parent_span_id": self.event["trace.parent_span"] or None,
            "parent_event_id": self.parent_event_id,
            "generation": self.generation,
            "errors": self.errors,
        }

    def full_dict(self, detailed: bool = False) -> FullResponse:
        result = cast(FullResponse, self.to_dict())
        if detailed and "transaction.status" in self.event:
            result.update(
                {
                    "transaction.status": SPAN_STATUS_CODE_TO_NAME.get(
                        self.event["transaction.status"], "unknown"
                    ),
                }
            )
        if self.nodestore_event:
            result["timestamp"] = self.nodestore_event.data.get("timestamp")
            result["start_timestamp"] = self.nodestore_event.data.get("start_timestamp")
            if detailed:
                if "measurements" in self.nodestore_event.data:
                    result["measurements"] = self.nodestore_event.data.get("measurements")
                result["_meta"] = {}
                result["tags"], result["_meta"]["tags"] = get_tags_with_meta(self.nodestore_event)
        # Only add children that have nodestore events, which may be missing if we're pruning for quick trace
        result["children"] = [
            child.full_dict(detailed) for child in self.children if child.nodestore_event
        ]
        return result


def find_event(
    items: Iterable[Optional[_T]],
    function: Callable[[Optional[_T]], Any],
    default: Optional[_T] = None,
) -> Optional[_T]:
    return next(filter(function, items), default)


def is_root(item: SnubaTransaction) -> bool:
    return item.get("root", "0") == "1"


def child_sort_key(item: TraceEvent) -> List[int]:
    if item.nodestore_event:
        return [
            item.nodestore_event.data["start_timestamp"],
            item.nodestore_event.data["timestamp"],
        ]
    # The sorting of items without nodestore events doesn't matter cause we drop them
    else:
        return [0]


def group_length(length: int) -> str:
    if length == 1:
        return "1"
    elif length < 10:
        return "<10"
    elif length < 100:
        return "<100"
    else:
        return ">100"


def query_trace_data(
    trace_id: str, params: Mapping[str, str]
) -> Tuple[Sequence[SnubaTransaction], Sequence[SnubaError]]:
    transaction_query = discover.prepare_discover_query(
        selected_columns=[
            "id",
            "transaction.status",
            "transaction.op",
            "transaction.duration",
            "transaction",
            "timestamp",
            # project gets the slug, and project.id gets added automatically
            "project",
            "trace.span",
            "trace.parent_span",
            'to_other(trace.parent_span, "", 0, 1) AS root',
        ],
        # We want to guarantee at least getting the root, and hopefully events near it with timestamp
        # id is just for consistent results
        orderby=["-root", "timestamp", "id"],
        params=params,
        query=f"event.type:transaction trace:{trace_id}",
    )
    error_query = discover.prepare_discover_query(
        selected_columns=[
            "id",
            "project",
            "timestamp",
            "trace.span",
            "transaction",
            "issue",
            "title",
            "tags[level]",
        ],
        # Don't add timestamp to this orderby as snuba will have to split the time range up and make multiple queries
        orderby=["id"],
        params=params,
        query=f"!event.type:transaction trace:{trace_id}",
        auto_fields=False,
    )
    snuba_params = [
        SnubaQueryParams(
            dataset=Dataset.Discover,
            start=snuba_filter.start,
            end=snuba_filter.end,
            groupby=snuba_filter.groupby,
            conditions=snuba_filter.conditions,
            filter_keys=snuba_filter.filter_keys,
            aggregations=snuba_filter.aggregations,
            selected_columns=snuba_filter.selected_columns,
            having=snuba_filter.having,
            orderby=snuba_filter.orderby,
            limit=MAX_TRACE_SIZE,
        )
        for snuba_filter in [transaction_query.filter, error_query.filter]
    ]
    results = bulk_raw_query(
        snuba_params,
        referrer="api.trace-view.get-events",
    )
    transformed_results = [
        discover.transform_results(result, query.fields["functions"], query.columns, query.filter)[
            "data"
        ]
        for result, query in zip(results, [transaction_query, error_query])
    ]
    return cast(Sequence[SnubaTransaction], transformed_results[0]), cast(
        Sequence[SnubaError], transformed_results[1]
    )


class OrganizationEventsTraceEndpointBase(OrganizationEventsV2EndpointBase):  # type: ignore
    def has_feature(self, organization: Organization, request: HttpRequest) -> bool:
        return bool(
            features.has("organizations:performance-view", organization, actor=request.user)
        )

    @staticmethod
    def serialize_error(event: SnubaError) -> TraceError:
        return {
            "event_id": event["id"],
            "issue_id": event["issue.id"],
            "span": event["trace.span"],
            "project_id": event["project.id"],
            "project_slug": event["project"],
            "title": event["title"],
            "level": event["tags[level]"],
        }

    @staticmethod
    def construct_parent_map(
        events: Sequence[SnubaTransaction],
    ) -> Dict[str, List[SnubaTransaction]]:
        """A mapping of span ids to their transactions

        - Transactions are associated to each other via parent_span_id
        """
        parent_map: Dict[str, List[SnubaTransaction]] = defaultdict(list)
        for item in events:
            if not is_root(item):
                parent_map[item["trace.parent_span"]].append(item)
        return parent_map

    @staticmethod
    def construct_error_map(events: Sequence[SnubaError]) -> Dict[str, List[SnubaError]]:
        """A mapping of span ids to their errors

        key depends on the event type:
        - Errors are associated to transactions via span_id
        """
        parent_map: Dict[str, List[SnubaError]] = defaultdict(list)
        for item in events:
            parent_map[item["trace.span"]].append(item)
        return parent_map

    @staticmethod
    def record_analytics(
        transactions: Sequence[SnubaTransaction], trace_id: str, user_id: int, org_id: int
    ) -> None:
        with sentry_sdk.start_span(op="recording.analytics"):
            len_transactions = len(transactions)

            sentry_sdk.set_tag("trace_view.trace", trace_id)
            sentry_sdk.set_tag("trace_view.transactions", len_transactions)
            sentry_sdk.set_tag("trace_view.transactions.grouped", group_length(len_transactions))
            projects: Set[int] = set()
            for transaction in transactions:
                projects.add(transaction["project.id"])

            len_projects = len(projects)
            sentry_sdk.set_tag("trace_view.projects", len_projects)
            sentry_sdk.set_tag("trace_view.projects.grouped", group_length(len_projects))

    def get(self, request: HttpRequest, organization: Organization, trace_id: str) -> HttpResponse:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            # The trace view isn't useful without global views, so skipping the check here
            params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response(status=404)

        detailed: bool = request.GET.get("detailed", "0") == "1"
        event_id: Optional[str] = request.GET.get("event_id")

        # Only need to validate event_id as trace_id is validated in the URL
        if event_id and not is_event_id(event_id):
            return Response({"detail": INVALID_EVENT_DETAILS.format("Event")}, status=400)

        with self.handle_query_errors():
            transactions, errors = query_trace_data(trace_id, params)
            if len(transactions) == 0:
                return Response(status=404)
            self.record_analytics(transactions, trace_id, self.request.user.id, organization.id)

        warning_extra: Dict[str, str] = {"trace": trace_id, "organization": organization}

        # Look for the roots
        roots: List[SnubaTransaction] = []
        for item in transactions:
            if is_root(item):
                roots.append(item)
            else:
                break
        if len(roots) > 1:
            sentry_sdk.set_tag("discover.trace-view.warning", "root.extra-found")
            logger.warning(
                "discover.trace-view.root.extra-found",
                {"extra_roots": len(roots), **warning_extra},
            )

        return Response(
            self.serialize(transactions, errors, roots, warning_extra, event_id, detailed)
        )


class OrganizationEventsTraceLightEndpoint(OrganizationEventsTraceEndpointBase):
    @staticmethod
    def get_current_transaction(
        transactions: Sequence[SnubaTransaction], errors: Sequence[SnubaError], event_id: str
    ) -> Tuple[SnubaTransaction, Event]:
        """Given an event_id return the related transaction event

        The event_id could be for an error, since we show the quick-trace
        for both event types
        We occasionally have to get the nodestore data, so this function returns
        the nodestore event as well so that we're doing that in one location.
        """
        transaction_event = find_event(
            transactions, lambda item: item is not None and item["id"] == event_id
        )
        if transaction_event is not None:
            return transaction_event, eventstore.get_event_by_id(
                transaction_event["project.id"], transaction_event["id"]
            )

        # The event couldn't be found, it might be an error
        error_event = find_event(errors, lambda item: item is not None and item["id"] == event_id)
        # Alright so we're looking at an error, time to see if we can find its transaction
        if error_event is not None:
            # Unfortunately the only association from an event back to its transaction is name & span_id
            # First maybe we got lucky and the error happened on the transaction's "span"
            error_span = error_event["trace.span"]
            transaction_event = find_event(
                transactions, lambda item: item is not None and item["trace.span"] == error_span
            )
            if transaction_event is not None:
                return transaction_event, eventstore.get_event_by_id(
                    transaction_event["project.id"], transaction_event["id"]
                )
            # We didn't get lucky, time to talk to nodestore...
            for transaction_event in transactions:
                if transaction_event["transaction"] != error_event["transaction"]:
                    continue

                nodestore_event = eventstore.get_event_by_id(
                    transaction_event["project.id"], transaction_event["id"]
                )
                transaction_spans: NodeSpans = nodestore_event.data.get("spans", [])
                for span in transaction_spans:
                    if span["span_id"] == error_event["trace.span"]:
                        return transaction_event, nodestore_event

        # The current event couldn't be found in errors or transactions
        raise Http404()

    def serialize(
        self,
        transactions: Sequence[SnubaTransaction],
        errors: Sequence[SnubaError],
        roots: Sequence[SnubaTransaction],
        warning_extra: Dict[str, str],
        event_id: Optional[str],
        detailed: bool = False,
    ) -> Sequence[LightResponse]:
        """ Because the light endpoint could potentially have gaps between root and event we return a flattened list """
        if event_id is None:
            raise ParseError(detail="An event_id is required for the light trace")
        snuba_event, nodestore_event = self.get_current_transaction(transactions, errors, event_id)
        parent_map = self.construct_parent_map(transactions)
        error_map = self.construct_error_map(errors)
        trace_results: List[TraceEvent] = []
        current_generation: Optional[int] = None
        root_id: Optional[str] = None

        with sentry_sdk.start_span(op="building.trace", description="light trace"):
            # Going to nodestore is more expensive than looping twice so check if we're on the root first
            for root in roots:
                if root["id"] == snuba_event["id"]:
                    current_generation = 0
                    break

            if current_generation is None:
                for root in roots:
                    # We might not be necessarily connected to the root if we're on an orphan event
                    if root["id"] != snuba_event["id"]:
                        # Get the root event and see if the current event's span is in the root event
                        root_event = eventstore.get_event_by_id(root["project.id"], root["id"])
                        root_spans: NodeSpans = root_event.data.get("spans", [])
                        root_span = find_event(
                            root_spans,
                            lambda item: item is not None
                            and item["span_id"] == snuba_event["trace.parent_span"],
                        )

                        # We only know to add the root if its the direct parent
                        if root_span is not None:
                            # For the light response, the parent will be unknown unless it is a direct descendent of the root
                            root_id = root["id"]
                            trace_results.append(
                                TraceEvent(
                                    root,
                                    None,
                                    0,
                                )
                            )
                            current_generation = 1
                            break

            current_event = TraceEvent(snuba_event, root_id, current_generation)
            trace_results.append(current_event)

            spans: NodeSpans = nodestore_event.data.get("spans", [])
            # Need to include the transaction as a span as well
            spans.append({"span_id": snuba_event["trace.span"]})

            for span in spans:
                if span["span_id"] in error_map:
                    current_event.errors.extend(
                        [self.serialize_error(error) for error in error_map.pop(span["span_id"])]
                    )
                if span["span_id"] in parent_map:
                    child_events = parent_map.pop(span["span_id"])
                    trace_results.extend(
                        [
                            TraceEvent(
                                child_event,
                                snuba_event["id"],
                                (
                                    current_event.generation + 1
                                    if current_event.generation is not None
                                    else None
                                ),
                            )
                            for child_event in child_events
                        ]
                    )

        return [result.to_dict() for result in trace_results]


class OrganizationEventsTraceEndpoint(OrganizationEventsTraceEndpointBase):
    @staticmethod
    def update_children(event: TraceEvent) -> None:
        """Updates the childrens of subtraces

        - Generation could be incorrect from orphans where we've had to reconnect back to an orphan event that's
          already been encountered
        - Sorting children events by timestamp
        """
        parents = [event]
        iteration = 0
        while parents and iteration < MAX_TRACE_SIZE:
            iteration += 1
            parent = parents.pop()
            parent.children.sort(key=child_sort_key)
            for child in parent.children:
                child.generation = parent.generation + 1 if parent.generation is not None else None
                parents.append(child)

    def serialize(
        self,
        transactions: Sequence[SnubaTransaction],
        errors: Sequence[SnubaError],
        roots: Sequence[SnubaTransaction],
        warning_extra: Dict[str, str],
        event_id: Optional[str],
        detailed: bool = False,
    ) -> Sequence[FullResponse]:
        """For the full event trace, we return the results as a graph instead of a flattened list

        if event_id is passed, we prune any potential branches of the trace to make as few nodestore calls as
        possible
        """
        parent_map = self.construct_parent_map(transactions)
        error_map = self.construct_error_map(errors)
        parent_events: Dict[str, TraceEvent] = {}
        # TODO(3.7): Dictionary ordering in py3.6 is an implementation detail, using an OrderedDict because this way
        # we try to guarantee in py3.6 that the first item is the root. We can switch back to a normal dict when we're
        # on python 3.7.
        results_map: Dict[Optional[str], List[TraceEvent]] = OrderedDict()
        to_check: Deque[SnubaTransaction] = deque()
        # The root of the orphan tree we're currently navigating through
        orphan_root: Optional[SnubaTransaction] = None
        if roots:
            results_map[None] = []
        for root in roots:
            root_event = TraceEvent(root, None, 0)
            parent_events[root["id"]] = root_event
            results_map[None].append(root_event)
            to_check.append(root)

        with sentry_sdk.start_span(op="building.trace", description="full trace"):
            iteration = 0
            has_orphans = False
            while parent_map or to_check:
                if len(to_check) == 0:
                    has_orphans = True
                    # Grab any set of events from the parent map
                    parent_span_id, current_events = parent_map.popitem()

                    current_event, *siblings = current_events
                    # If there were any siblings put them back
                    if siblings:
                        parent_map[parent_span_id] = siblings

                    previous_event = parent_events[current_event["id"]] = TraceEvent(
                        current_event, None, 0
                    )

                    # Used to avoid removing the orphan from results entirely if we loop
                    orphan_root = current_event
                    # not using a defaultdict here as a DefaultOrderedDict isn't worth the effort
                    if parent_span_id in results_map:
                        results_map[parent_span_id].append(previous_event)
                    else:
                        results_map[parent_span_id] = [previous_event]
                else:
                    current_event = to_check.popleft()
                    previous_event = parent_events[current_event["id"]]

                # We've found the event for the quick trace so we can remove everything in the deque
                # As they're unrelated ancestors now
                if event_id and current_event["id"] == event_id:
                    # Remove any remaining events so we don't think they're orphans
                    while to_check:
                        to_remove = to_check.popleft()
                        if to_remove["trace.parent_span"] in parent_map:
                            del parent_map[to_remove["trace.parent_span"]]
                    to_check = deque()

                # This is faster than doing a call to get_events, since get_event_by_id only makes a call to snuba
                # when non transaction events are included.
                with sentry_sdk.start_span(op="nodestore", description="get_event_by_id"):
                    nodestore_event = eventstore.get_event_by_id(
                        current_event["project.id"], current_event["id"]
                    )

                previous_event.nodestore_event = nodestore_event

                spans: NodeSpans = nodestore_event.data.get("spans", [])
                # Need to include the transaction as a span as well
                spans.append({"span_id": previous_event.event["trace.span"]})

                for child in spans:
                    if child["span_id"] in error_map:
                        previous_event.errors.extend(
                            [
                                self.serialize_error(error)
                                for error in error_map.pop(child["span_id"])
                            ]
                        )
                    # We need to connect back to an existing orphan trace
                    if (
                        has_orphans
                        and
                        # The child event has already been checked
                        child["span_id"] in results_map
                        and orphan_root is not None
                        and
                        # In the case of a span loop popping the current root removes the orphan subtrace
                        child["span_id"] != orphan_root["trace.parent_span"]
                    ):
                        orphan_subtraces = results_map.pop(child["span_id"])
                        for orphan_subtrace in orphan_subtraces:
                            orphan_subtrace.parent_event_id = previous_event.event["id"]
                        previous_event.children.extend(orphan_subtraces)
                    if child["span_id"] not in parent_map:
                        continue
                    # Avoid potential span loops by popping, so we don't traverse the same nodes twice
                    child_events = parent_map.pop(child["span_id"])

                    for child_event in child_events:
                        parent_events[child_event["id"]] = TraceEvent(
                            child_event,
                            current_event["id"],
                            previous_event.generation + 1
                            if previous_event.generation is not None
                            else None,
                        )
                        # Add this event to its parent's children
                        previous_event.children.append(parent_events[child_event["id"]])

                        to_check.append(child_event)
                # Limit iterations just to be safe
                iteration += 1
                if iteration > MAX_TRACE_SIZE:
                    sentry_sdk.set_tag("discover.trace-view.warning", "surpassed-trace-limit")
                    logger.warning(
                        "discover.trace-view.surpassed-trace-limit",
                        extra=warning_extra,
                    )
                    break

        root_traces: List[TraceEvent] = []
        orphans: List[TraceEvent] = []
        for index, result in enumerate(results_map.values()):
            for subtrace in result:
                self.update_children(subtrace)
            if index > 0 or len(roots) == 0:
                orphans.extend(result)
            elif len(roots) > 0:
                root_traces = result
        # We sort orphans and roots separately because we always want the root(s) as the first element(s)
        root_traces.sort(key=child_sort_key)
        orphans.sort(key=child_sort_key)
        return [trace.full_dict(detailed) for trace in root_traces] + [
            orphan.full_dict(detailed) for orphan in orphans
        ]


class OrganizationEventsTraceMetaEndpoint(OrganizationEventsTraceEndpointBase):
    def get(self, request: HttpRequest, organization: Organization, trace_id: str) -> HttpResponse:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            # The trace meta isn't useful without global views, so skipping the check here
            params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response(status=404)

        with self.handle_query_errors():
            result = discover.query(
                selected_columns=[
                    "count_unique(project_id) as projects",
                    "count_if(event.type, equals, transaction) as transactions",
                    "count_if(event.type, notEquals, transaction) as errors",
                ],
                params=params,
                query=f"trace:{trace_id}",
                limit=1,
                referrer="api.trace-view.get-meta",
            )
            if len(result["data"]) == 0:
                return Response(status=404)
        return Response(self.serialize(result["data"][0]))

    @staticmethod
    def serialize(results: Mapping[str, int]) -> Mapping[str, int]:
        return {
            # Values can be null if there's no result
            "projects": results.get("projects") or 0,
            "transactions": results.get("transactions") or 0,
            "errors": results.get("errors") or 0,
        }
