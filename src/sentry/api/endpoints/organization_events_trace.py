import logging
from collections import defaultdict, deque
from typing import (
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
    TypedDict,
    TypeVar,
    cast,
)

import sentry_sdk
from django.http import Http404, HttpRequest, HttpResponse
from rest_framework.exceptions import ParseError
from rest_framework.response import Response
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME
from snuba_sdk import AliasedExpression, Column, Function

from sentry import constants, eventstore, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.serializers.models.event import get_tags_with_meta
from sentry.eventstore.models import Event
from sentry.models import Group, Organization
from sentry.search.events.builder import QueryBuilder
from sentry.snuba import discover
from sentry.utils.numbers import base32_encode, format_grouped_length
from sentry.utils.performance_issues.performance_detection import EventPerformanceProblem
from sentry.utils.sdk import set_measurement
from sentry.utils.snuba import Dataset, bulk_snql_query
from sentry.utils.validators import INVALID_ID_DETAILS, is_event_id

logger: logging.Logger = logging.getLogger(__name__)
MAX_TRACE_SIZE: int = 100


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
        "issue.ids": List[int],
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


class TraceError(TypedDict):
    event_id: str
    issue_id: int
    span: str
    project_id: int
    project_slug: str
    title: str
    level: str


class TracePerformanceIssue(TypedDict):
    event_id: str
    issue_id: int
    issue_short_id: Optional[str]
    span: List[str]
    suspect_spans: List[str]
    project_id: int
    project_slug: str
    title: str
    level: str
    culprit: str
    type: int
    start: Optional[float]
    end: Optional[float]


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
        "performance_issues": List[TracePerformanceIssue],
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
        "profile_id": Optional[str],
        "generation": Optional[int],
        "errors": List[TraceError],
        "performance_issues": List[TracePerformanceIssue],
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
        self,
        event: SnubaTransaction,
        parent: Optional[str],
        generation: Optional[int],
        light: bool = False,
    ) -> None:
        self.event: SnubaTransaction = event
        self.errors: List[TraceError] = []
        self.children: List[TraceEvent] = []
        self.performance_issues: List[TracePerformanceIssue] = []

        # Can be None on the light trace when we don't know the parent
        self.parent_event_id: Optional[str] = parent
        self.generation: Optional[int] = generation

        # Added as required because getting the nodestore_event is expensive
        self._nodestore_event: Optional[Event] = None
        self.fetched_nodestore: bool = False
        self.load_performance_issues(light)

    @property
    def nodestore_event(self) -> Optional[Event]:
        with sentry_sdk.start_span(op="nodestore", description="get_event_by_id"):
            if self._nodestore_event is None and not self.fetched_nodestore:
                self.fetched_nodestore = True
                self._nodestore_event = eventstore.get_event_by_id(
                    self.event["project.id"], self.event["id"]
                )
        return self._nodestore_event

    def load_performance_issues(self, light: bool) -> None:
        """Doesn't get suspect spans, since we don't need that for the light view"""
        for group_id in self.event["issue.ids"]:
            group = Group.objects.filter(id=group_id, project=self.event["project.id"]).first()
            if group is None:
                continue

            suspect_spans: List[str] = []
            start: Optional[float] = None
            end: Optional[float] = None
            if light:
                # This value doesn't matter for the light view
                span = [self.event["trace.span"]]
            else:
                if self.nodestore_event is not None:
                    hashes = self.nodestore_event.get_hashes().hashes
                    problems = [
                        eventproblem.problem
                        for eventproblem in EventPerformanceProblem.fetch_multi(
                            [(self.nodestore_event, event_hash) for event_hash in hashes]
                        )
                    ]
                    unique_spans: Set[str] = set()
                    for problem in problems:
                        if problem.parent_span_ids is not None:
                            unique_spans = unique_spans.union(problem.parent_span_ids)
                    span = list(unique_spans)
                    for event_span in self.nodestore_event.data.get("spans", []):
                        for problem in problems:
                            if event_span.get("span_id") in problem.offender_span_ids:
                                try:
                                    start_timestamp = float(event_span.get("start_timestamp"))
                                    if start is None:
                                        start = start_timestamp
                                    else:
                                        start = min(start, start_timestamp)
                                except ValueError:
                                    pass
                                try:
                                    end_timestamp = float(event_span.get("timestamp"))
                                    if end is None:
                                        end = end_timestamp
                                    else:
                                        end = max(end, end_timestamp)
                                except ValueError:
                                    pass
                                suspect_spans.append(event_span.get("span_id"))
                else:
                    span = [self.event["trace.span"]]

            # Logic for qualified_short_id is copied from property on the Group model
            # to prevent an N+1 query from accessing project.slug everytime
            qualified_short_id = None
            project_slug = self.event["project"]
            if group.short_id is not None:
                qualified_short_id = f"{project_slug.upper()}-{base32_encode(group.short_id)}"

            self.performance_issues.append(
                {
                    "event_id": self.event["id"],
                    "issue_id": group_id,
                    "issue_short_id": qualified_short_id,
                    "span": span,
                    "suspect_spans": suspect_spans,
                    "project_id": self.event["project.id"],
                    "project_slug": self.event["project"],
                    "title": group.title,
                    "level": constants.LOG_LEVELS[group.level],
                    "culprit": group.culprit,
                    "type": group.type,
                    "start": start,
                    "end": end,
                }
            )

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
            "performance_issues": self.performance_issues,
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

            contexts = self.nodestore_event.data.get("contexts", {})
            profile_id = contexts.get("profile", {}).get("profile_id")
            if profile_id is not None:
                result["profile_id"] = profile_id

            if detailed:
                if "measurements" in self.nodestore_event.data:
                    result["measurements"] = self.nodestore_event.data.get("measurements")
                result["_meta"] = {}
                result["tags"], result["_meta"]["tags"] = get_tags_with_meta(self.nodestore_event)
        # Only add children that have nodestore events, which may be missing if we're pruning for trace navigator
        result["children"] = [
            child.full_dict(detailed) for child in self.children if child.fetched_nodestore
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
    if item.fetched_nodestore and item.nodestore_event is not None:
        return [
            item.nodestore_event.data["start_timestamp"],
            item.nodestore_event.data["timestamp"],
        ]
    # The sorting of items without nodestore events doesn't matter cause we drop them
    else:
        return [0]


def count_performance_issues(trace_id: str, params: Mapping[str, str]) -> int:
    transaction_query = QueryBuilder(
        Dataset.IssuePlatform,
        params,
        query=f"trace:{trace_id}",
        selected_columns=[],
        limit=MAX_TRACE_SIZE,
    )
    transaction_query.columns.append(Function("count()", alias="total_groups"))
    count = transaction_query.run_query("api.trace-view.count-performance-issues")
    return cast(int, count["data"][0].get("total_groups", 0))


def query_trace_data(
    trace_id: str, params: Mapping[str, str]
) -> Tuple[Sequence[SnubaTransaction], Sequence[SnubaError]]:
    transaction_query = QueryBuilder(
        Dataset.Transactions,
        params,
        query=f"trace:{trace_id}",
        selected_columns=[
            "id",
            "transaction.status",
            "transaction.op",
            "transaction.duration",
            "transaction",
            "timestamp",
            "project",
            "project.id",
            "trace.span",
            "trace.parent_span",
            'to_other(trace.parent_span, "", 0, 1) AS root',
        ],
        # We want to guarantee at least getting the root, and hopefully events near it with timestamp
        # id is just for consistent results
        orderby=["-root", "timestamp", "id"],
        limit=MAX_TRACE_SIZE,
    )
    transaction_query.columns.append(AliasedExpression(Column("group_ids"), "issue.ids"))
    error_query = QueryBuilder(
        Dataset.Events,
        params,
        query=f"trace:{trace_id}",
        selected_columns=[
            "id",
            "project",
            "project.id",
            "timestamp",
            "trace.span",
            "transaction",
            "issue",
            "title",
            "tags[level]",
        ],
        # Don't add timestamp to this orderby as snuba will have to split the time range up and make multiple queries
        orderby=["id"],
        auto_fields=False,
        limit=MAX_TRACE_SIZE,
    )
    results = bulk_snql_query(
        [transaction_query.get_snql_query(), error_query.get_snql_query()],
        referrer="api.trace-view.get-events",
    )
    transformed_results = [
        query.process_results(result)["data"]
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
            sentry_sdk.set_tag(
                "trace_view.transactions.grouped", format_grouped_length(len_transactions)
            )
            set_measurement("trace_view.transactions", len_transactions)
            projects: Set[int] = set()
            for transaction in transactions:
                projects.add(transaction["project.id"])

            len_projects = len(projects)
            sentry_sdk.set_tag("trace_view.projects", len_projects)
            sentry_sdk.set_tag("trace_view.projects.grouped", format_grouped_length(len_projects))
            set_measurement("trace_view.projects", len_projects)

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
            return Response({"detail": INVALID_ID_DETAILS.format("Event ID")}, status=400)

        with self.handle_query_errors():
            transactions, errors = query_trace_data(trace_id, params)
            if len(transactions) == 0:
                return Response(status=404)
            self.record_analytics(transactions, trace_id, self.request.user.id, organization.id)

        warning_extra: Dict[str, str] = {"trace": trace_id, "organization": organization.slug}

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
                extra={"extra_roots": len(roots), **warning_extra},
            )

        return Response(
            self.serialize(transactions, errors, roots, warning_extra, event_id, detailed)
        )


@region_silo_endpoint
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
        """Because the light endpoint could potentially have gaps between root and event we return a flattened list"""
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
                                    True,
                                )
                            )
                            current_generation = 1
                            break

            current_event = TraceEvent(snuba_event, root_id, current_generation, True)
            trace_results.append(current_event)

            spans: NodeSpans = nodestore_event.data.get("spans", [])
            # Need to include the transaction as a span as well
            #
            # Important that we left pad the span id with 0s because
            # the span id is stored as an UInt64 and converted into
            # a hex string when quering. However, the conversion does
            # not ensure that the final span id is 16 chars long since
            # it's a naive base 10 to base 16 conversion.
            spans.append({"span_id": snuba_event["trace.span"].rjust(16, "0")})

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
                                True,
                            )
                            for child_event in child_events
                        ]
                    )

        return [result.to_dict() for result in trace_results]


@region_silo_endpoint
class OrganizationEventsTraceEndpoint(OrganizationEventsTraceEndpointBase):
    @staticmethod
    def update_children(event: TraceEvent) -> None:
        """Updates the children of subtraces

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
        results_map: Dict[Optional[str], List[TraceEvent]] = defaultdict(list)
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
                    results_map[parent_span_id].append(previous_event)
                else:
                    current_event = to_check.popleft()
                    previous_event = parent_events[current_event["id"]]

                # We've found the event for the trace navigator so we can remove everything in the deque
                # As they're unrelated ancestors now
                if event_id and current_event["id"] == event_id:
                    # Remove any remaining events so we don't think they're orphans
                    while to_check:
                        to_remove = to_check.popleft()
                        if to_remove["trace.parent_span"] in parent_map:
                            del parent_map[to_remove["trace.parent_span"]]
                    to_check = deque()

                spans: NodeSpans = (
                    previous_event.nodestore_event.data.get("spans", [])
                    if previous_event.nodestore_event
                    else []
                )

                # Need to include the transaction as a span as well
                #
                # Important that we left pad the span id with 0s because
                # the span id is stored as an UInt64 and converted into
                # a hex string when quering. However, the conversion does
                # not ensure that the final span id is 16 chars long since
                # it's a naive base 10 to base 16 conversion.
                spans.append({"span_id": previous_event.event["trace.span"].rjust(16, "0")})

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

        if len(orphans) > 0:
            sentry_sdk.set_tag("discover.trace-view.contains-orphans", "yes")
            logger.warning("discover.trace-view.contains-orphans", extra=warning_extra)

        return [trace.full_dict(detailed) for trace in root_traces] + [
            orphan.full_dict(detailed) for orphan in orphans
        ]


@region_silo_endpoint
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
            # Merge the result back into the first query
            result["data"][0]["performance_issues"] = count_performance_issues(trace_id, params)
        return Response(self.serialize(result["data"][0]))

    @staticmethod
    def serialize(results: Mapping[str, int]) -> Mapping[str, int]:
        return {
            # Values can be null if there's no result
            "projects": results.get("projects") or 0,
            "transactions": results.get("transactions") or 0,
            "errors": results.get("errors") or 0,
            "performance_issues": results.get("performance_issues") or 0,
        }
