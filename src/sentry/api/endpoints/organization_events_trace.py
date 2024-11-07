from __future__ import annotations

import abc
import logging
from collections import defaultdict, deque
from collections.abc import Callable, Iterable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from typing import Any, Deque, Optional, TypedDict, TypeVar, cast

import sentry_sdk
from django.http import Http404, HttpRequest, HttpResponse
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME
from snuba_sdk import Column, Condition, Function, Op

from sentry import constants, eventstore, features, options
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.serializers.models.event import get_tags_with_meta
from sentry.api.utils import handle_query_errors, update_snuba_params_with_timestamp
from sentry.eventstore.models import Event, GroupEvent
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.organizations.services.organization import RpcOrganization
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.builder.spans_indexed import SpansIndexedQueryBuilder
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.query_sources import QuerySource
from sentry.snuba.referrer import Referrer
from sentry.utils.iterators import chunked
from sentry.utils.numbers import base32_encode, format_grouped_length
from sentry.utils.sdk import set_measurement
from sentry.utils.snuba import bulk_snuba_queries
from sentry.utils.validators import INVALID_ID_DETAILS, is_event_id, is_span_id

logger: logging.Logger = logging.getLogger(__name__)
MAX_TRACE_SIZE: int = 100


_T = TypeVar("_T")
NodeSpans = list[dict[str, Any]]
SnubaSpan = TypedDict(
    "SnubaSpan",
    {
        "precise.finish_ts": str,
        "precise.start_ts": str,
        "problem": IssueOccurrence,
        "span_id": str,
        "transaction.id": str,
    },
)
SnubaTransaction = TypedDict(
    "SnubaTransaction",
    {
        "id": str,
        "issue.ids": list[int],
        "issue_occurrences": Sequence[IssueOccurrence],
        "measurements": dict[str, int],
        "occurrence_id": list[str],
        "occurrence_spans": list[SnubaSpan],
        "occurrence_to_issue_id": dict[str, list[int]],
        "precise.finish_ts": int,
        "precise.start_ts": int,
        "profile.id": str,
        "profiler.id": str,
        "project": str,
        "project.id": int,
        "root": str,
        "sdk.name": str,
        "timestamp": str,
        "trace.parent_span": str,
        "trace.parent_transaction": Optional[str],
        "trace.span": str,
        "transaction": str,
        "transaction.duration": int,
        "transaction.op": str,
        "transaction.status": int,
    },
)
SnubaError = TypedDict(
    "SnubaError",
    {
        "id": str,
        "issue.id": int,
        "message": str,
        "project": str,
        "project.id": int,
        "tags[level]": str,
        "timestamp": str,
        "title": str,
        "trace.span": str,
        "trace.transaction": str | None,
        "transaction": str,
    },
)


class TraceError(TypedDict):
    event_id: str
    event_type: str
    generation: int
    issue_id: int
    level: str
    message: str
    project_id: int
    project_slug: str
    span: str
    timestamp: float
    title: str


class TracePerformanceIssue(TypedDict):
    culprit: str | None
    end: float | None
    event_id: str
    issue_id: int
    issue_short_id: str | None
    level: str
    project_id: int
    project_slug: str
    span: list[str]
    start: float | None
    suspect_spans: list[str]
    title: str
    type: int


LightResponse = TypedDict(
    "LightResponse",
    {
        "errors": list[TraceError],
        "event_id": str,
        "generation": Optional[int],
        "parent_event_id": Optional[str],
        "parent_span_id": Optional[str],
        "performance_issues": list[TracePerformanceIssue],
        "project_id": int,
        "project_slug": str,
        "span_id": str,
        "timestamp": float,
        "transaction": str,
        "transaction.duration": int,
        "transaction.op": str,
    },
)
FullResponse = TypedDict(
    "FullResponse",
    {
        "_meta": dict[str, Any],
        "children": list["FullResponse"],
        "errors": list[TraceError],
        "event_id": str,
        "generation": Optional[int],
        "measurements": dict[str, int],
        "parent_event_id": Optional[str],
        "parent_span_id": Optional[str],
        "performance_issues": list[TracePerformanceIssue],
        "profile_id": Optional[str],
        "profiler_id": Optional[str],
        "project_id": int,
        "project_slug": str,
        "sdk_name": Optional[str],
        "span_id": str,
        "start_timestamp": str | int,
        "tags": list[tuple[str, str]],
        "timestamp": str | int,
        "transaction": str,
        "transaction.duration": int,
        "transaction.op": str,
        "transaction.status": str,
    },
)


class SerializedTrace(TypedDict):
    orphan_errors: list[TraceError]
    transactions: list[FullResponse]


class TraceEvent:
    def __init__(
        self,
        event: SnubaTransaction,
        parent: str | None,
        generation: int | None,
        light: bool = False,
        snuba_params: SnubaParams | None = None,
        span_serialized: bool = False,
        query_source: QuerySource | None = QuerySource.SENTRY_BACKEND,
    ) -> None:
        self.event: SnubaTransaction = event
        self.errors: list[TraceError] = []
        self.children: list[TraceEvent] = []
        self.performance_issues: list[TracePerformanceIssue] = []
        self.query_source = query_source

        # Can be None on the light trace when we don't know the parent
        self.parent_event_id: str | None = parent
        self.generation: int | None = generation

        # Added as required because getting the nodestore_event is expensive
        self._nodestore_event: Event | GroupEvent | None = None
        self.fetched_nodestore: bool = span_serialized
        self.span_serialized = span_serialized
        if len(self.event["issue.ids"]) > 0:
            if self.span_serialized:
                self.load_span_serialized_performance_issues(light)
            else:
                self.load_performance_issues(light, snuba_params)

    @property
    def nodestore_event(self) -> Event | GroupEvent | None:
        if self._nodestore_event is None and not self.fetched_nodestore:
            with sentry_sdk.start_span(op="nodestore", name="get_event_by_id"):
                self.fetched_nodestore = True
                self._nodestore_event = eventstore.backend.get_event_by_id(
                    self.event["project.id"], self.event["id"]
                )
        return self._nodestore_event

    def load_span_serialized_performance_issues(self, light: bool) -> None:
        """Rewriting load_performance_issues from scratch so the logic is more independent"""
        memoized_groups = {}
        for event_span in self.event["occurrence_spans"]:
            unique_spans: set[str] = set()
            start: float | None = None
            end: float | None = None
            suspect_spans: list[str] = []
            problem = event_span["problem"]
            offender_span_ids = problem.evidence_data.get("offender_span_ids", [])
            for group_id in self.event["occurrence_to_issue_id"][problem.id]:
                if group_id not in memoized_groups:
                    memoized_groups[group_id] = Group.objects.get(
                        id=group_id, project=self.event["project.id"]
                    )
                group = memoized_groups[group_id]
                if event_span.get("span_id") in offender_span_ids:
                    start_timestamp = float(event_span["precise.start_ts"])
                    if start is None:
                        start = start_timestamp
                    else:
                        start = min(start, start_timestamp)
                    end_timestamp = float(event_span["precise.finish_ts"])
                    if end is None:
                        end = end_timestamp
                    else:
                        end = max(end, end_timestamp)
                    suspect_spans.append(event_span["span_id"])

                parent_span_ids = problem.evidence_data.get("parent_span_ids")
                if parent_span_ids is not None:
                    unique_spans = unique_spans.union(parent_span_ids)

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
                        "span": list(unique_spans),
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

    def load_performance_issues(self, light: bool, snuba_params: SnubaParams | None) -> None:
        """Doesn't get suspect spans, since we don't need that for the light view"""
        for group_id in self.event["issue.ids"]:
            group = Group.objects.filter(id=group_id, project=self.event["project.id"]).first()
            if group is None:
                continue

            suspect_spans: list[str] = []
            unique_spans: set[str] = set()
            start: float | None = None
            end: float | None = None
            if light:
                # This value doesn't matter for the light view
                span = [self.event["trace.span"]]
            else:
                if self.nodestore_event is not None:
                    occurrence_query = DiscoverQueryBuilder(
                        Dataset.IssuePlatform,
                        # Params is ignored if snuba_params is passed
                        params={},
                        snuba_params=snuba_params,
                        query=f"event_id:{self.event['id']}",
                        selected_columns=["occurrence_id"],
                    )
                    occurrence_ids = occurrence_query.process_results(
                        occurrence_query.run_query(
                            referrer=Referrer.API_TRACE_VIEW_GET_OCCURRENCE_IDS.value,
                            query_source=self.query_source,
                        )
                    )["data"]

                    issue_occurrences = IssueOccurrence.fetch_multi(
                        [str(occurrence.get("occurrence_id")) for occurrence in occurrence_ids],
                        self.event["project.id"],
                    )
                    for problem in issue_occurrences:
                        if problem is None:
                            continue
                        parent_span_ids = problem.evidence_data.get("parent_span_ids")
                        if parent_span_ids is not None:
                            unique_spans = unique_spans.union(parent_span_ids)
                    span = list(unique_spans)
                    for event_span in self.nodestore_event.data.get("spans", []):
                        for problem in issue_occurrences:
                            if problem is None or problem.evidence_data is None:
                                continue
                            offender_span_ids = problem.evidence_data.get("offender_span_ids", [])
                            if event_span.get("span_id") in offender_span_ids:
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
        timestamp = datetime.fromisoformat(self.event["timestamp"]).timestamp()
        return {
            "event_id": self.event["id"],
            "span_id": self.event["trace.span"],
            "timestamp": timestamp,
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

    def full_dict(
        self, detailed: bool = False, visited: set[str] | None = None
    ) -> FullResponse | None:
        if visited is None:
            visited = set()
        event_id = self.event["id"]
        # We're in a loop!
        if event_id in visited:
            return None
        else:
            visited.add(self.event["id"])
        result = cast(FullResponse, self.to_dict())
        if detailed and "transaction.status" in self.event:
            result.update(
                {
                    "transaction.status": SPAN_STATUS_CODE_TO_NAME.get(
                        self.event["transaction.status"], "unknown"
                    ),
                }
            )
        if self.span_serialized:
            result["timestamp"] = self.event["precise.finish_ts"]
            result["start_timestamp"] = self.event["precise.start_ts"]
            result["profile_id"] = self.event["profile.id"]
            result["profiler_id"] = self.event["profiler.id"]
            result["sdk_name"] = self.event["sdk.name"]
            # TODO: once we're defaulting measurements we don't need this check
            if "measurements" in self.event:
                result["measurements"] = self.event["measurements"]
        if self.nodestore_event:
            result["timestamp"] = cast(str, self.nodestore_event.data.get("timestamp"))
            result["start_timestamp"] = cast(str, self.nodestore_event.data.get("start_timestamp"))
            result["sdk_name"] = self.event["sdk.name"]

            contexts = self.nodestore_event.data.get("contexts", {})
            profile_id = contexts.get("profile", {}).get("profile_id")
            if profile_id is not None:
                result["profile_id"] = profile_id
            result["profiler_id"] = self.event["profiler.id"]

            if detailed:
                if "measurements" in self.nodestore_event.data:
                    result["measurements"] = cast(
                        dict[str, int], self.nodestore_event.data.get("measurements")
                    )
                result["_meta"] = {}
                result["tags"], result["_meta"]["tags"] = get_tags_with_meta(self.nodestore_event)
        # Only add children that have nodestore events, which may be missing if we're pruning for trace navigator
        result["children"] = []
        for child in self.children:
            if child.fetched_nodestore:
                child_dict = child.full_dict(detailed, visited)
                if child_dict is not None:
                    result["children"].append(child_dict)
        return result


def find_timestamp_params(transactions: Sequence[SnubaTransaction]) -> dict[str, datetime | None]:
    min_timestamp = None
    max_timestamp = None
    if transactions:
        first_timestamp = datetime.fromisoformat(transactions[0]["timestamp"])
        min_timestamp = first_timestamp
        max_timestamp = first_timestamp
        for transaction in transactions[1:]:
            timestamp = datetime.fromisoformat(transaction["timestamp"])
            if timestamp < min_timestamp:
                min_timestamp = timestamp
            elif timestamp > max_timestamp:
                max_timestamp = timestamp
    return {
        "min": min_timestamp,
        "max": max_timestamp,
    }


def find_event(
    items: Iterable[_T | None],
    function: Callable[[_T | None], Any],
    default: _T | None = None,
) -> _T | None:
    return next(filter(function, items), default)


def is_root(item: SnubaTransaction) -> bool:
    return item.get("root", "0") == "1"


def child_sort_key(item: TraceEvent) -> list[int | str]:
    if item.fetched_nodestore and item.nodestore_event is not None:
        return [
            item.nodestore_event.data["start_timestamp"],
            item.nodestore_event.data["timestamp"],
        ]
    elif item.span_serialized:
        return [
            item.event["precise.start_ts"],
            item.event["precise.finish_ts"],
            item.event["transaction"],
            item.event["id"],
        ]
    else:
        return [
            item.event["transaction"],
            item.event["id"],
        ]


def count_performance_issues(
    trace_id: str,
    params: SnubaParams,
    query_source: QuerySource | None = QuerySource.SENTRY_BACKEND,
) -> int:
    transaction_query = DiscoverQueryBuilder(
        Dataset.IssuePlatform,
        params={},
        snuba_params=params,
        query=f"trace:{trace_id}",
        selected_columns=[],
        limit=MAX_TRACE_SIZE,
    )
    transaction_query.columns.append(Function("count()", alias="total_groups"))
    count = transaction_query.run_query(
        referrer=Referrer.API_TRACE_VIEW_COUNT_PERFORMANCE_ISSUES.value,
        query_source=query_source,
    )
    return count["data"][0].get("total_groups", 0)


@sentry_sdk.tracing.trace
def create_transaction_params(
    trace_id: str,
    snuba_params: SnubaParams,
    query_source: QuerySource | None = QuerySource.SENTRY_BACKEND,
) -> SnubaParams:
    """Can't use the transaction params for errors since traces can be errors only"""
    query_metadata = options.get("performance.traces.query_timestamp_projects")
    sentry_sdk.set_tag("trace_view.queried_timestamp_projects", query_metadata)
    if not query_metadata:
        return snuba_params

    metadata_query = DiscoverQueryBuilder(
        Dataset.Discover,
        params={},
        snuba_params=snuba_params,
        query=f"trace:{trace_id}",
        selected_columns=[
            "min(timestamp)",
            "max(timestamp)",
            "project.id",
        ],
    )
    results = metadata_query.run_query(
        Referrer.API_TRACE_VIEW_GET_TIMESTAMP_PROJECTS.value, query_source=query_source
    )
    results = metadata_query.process_results(results)
    project_id_set = set()
    min_timestamp = None
    max_timestamp = None
    for row in results["data"]:
        current_min = datetime.fromisoformat(row["min_timestamp"])
        current_max = datetime.fromisoformat(row["max_timestamp"])
        if min_timestamp is None:
            min_timestamp = current_min
        if max_timestamp is None:
            max_timestamp = current_max

        if current_min < min_timestamp:
            min_timestamp = current_min
        if current_max > max_timestamp:
            max_timestamp = current_max

        project_id_set.add(row["project.id"])

    # Do not modify the params if anything comes back empty
    if len(project_id_set) == 0 or min_timestamp is None or max_timestamp is None:
        return snuba_params

    project_ids = list(project_id_set)
    # Reusing this option for now
    time_buffer = options.get("performance.traces.span_query_timebuffer_hours")
    transaction_params = snuba_params.copy()
    if min_timestamp:
        transaction_params.start = min_timestamp - timedelta(hours=time_buffer)
    if max_timestamp:
        transaction_params.end = max_timestamp + timedelta(hours=time_buffer)
    transaction_params.projects = [p for p in snuba_params.projects if p.id in project_ids]

    return transaction_params


@sentry_sdk.tracing.trace
def query_trace_data(
    trace_id: str,
    snuba_params: SnubaParams,
    transaction_params: SnubaParams,
    limit: int,
    event_id: str | None,
    use_spans: bool,
    query_source: QuerySource | None = QuerySource.SENTRY_BACKEND,
) -> tuple[Sequence[SnubaTransaction], Sequence[SnubaError]]:
    transaction_columns = [
        "id",
        "transaction.status",
        "transaction.op",
        "transaction.duration",
        "transaction",
        "timestamp",
        "precise.start_ts",
        "precise.finish_ts",
        "project",
        "project.id",
        "profile.id",
        "profiler.id",
        "sdk.name",
        "trace.span",
        "trace.parent_span",
        'to_other(trace.parent_span, "", 0, 1) AS root',
    ]
    # We want to guarantee at least getting the root, and hopefully events near it with timestamp
    # id is just for consistent results
    transaction_orderby = ["-root", "timestamp", "id"]
    if event_id is not None:
        # Already validated to be one of the two
        if is_event_id(event_id):
            transaction_columns.append(f'to_other(id, "{event_id}", 0, 1) AS target')
        else:
            transaction_columns.append(f'to_other(trace.span, "{event_id}", 0, 1) AS target')
        # Target is the event_id the frontend plans to render, we try to sort it to the top so it loads even if its not
        # within the query limit, needs to be the first orderby cause it takes precedence over finding the root
        transaction_orderby.insert(0, "-target")
    if use_spans:
        transaction_columns.extend(
            [
                "measurements.key",
                "measurements.value",
            ]
        )
    transaction_query = DiscoverQueryBuilder(
        Dataset.Transactions,
        params={},
        snuba_params=transaction_params,
        query=f"trace:{trace_id}",
        selected_columns=transaction_columns,
        orderby=transaction_orderby,
        limit=limit,
    )
    occurrence_query = DiscoverQueryBuilder(
        Dataset.IssuePlatform,
        params={},
        snuba_params=snuba_params,
        query=f"trace:{trace_id}",
        selected_columns=["event_id", "occurrence_id"],
        config=QueryBuilderConfig(
            functions_acl=["groupArray"],
        ),
    )
    occurrence_query.columns.append(
        Function("groupArray", parameters=[Column("group_id")], alias="issue.ids")
    )
    occurrence_query.groupby = [Column("event_id"), Column("occurrence_id")]

    error_query = DiscoverQueryBuilder(
        Dataset.Events,
        params={},
        snuba_params=snuba_params,
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
            "message",
            "tags[level]",
        ],
        # Don't add timestamp to this orderby as snuba will have to split the time range up and make multiple queries
        orderby=["id"],
        limit=limit,
        config=QueryBuilderConfig(
            auto_fields=False,
        ),
    )
    results = bulk_snuba_queries(
        [
            transaction_query.get_snql_query(),
            error_query.get_snql_query(),
            occurrence_query.get_snql_query(),
        ],
        referrer=Referrer.API_TRACE_VIEW_GET_EVENTS.value,
        query_source=query_source,
    )

    transformed_results = [
        query.process_results(result)["data"]
        for result, query in zip(results, [transaction_query, error_query, occurrence_query])
    ]

    # Join group IDs from the occurrence dataset to transactions data
    occurrence_issue_ids = defaultdict(list)
    occurrence_ids = defaultdict(list)
    for row in transformed_results[2]:
        occurrence_issue_ids[row["event_id"]].extend(row["issue.ids"])
        occurrence_ids[row["event_id"]].append(row["occurrence_id"])

    for result in transformed_results[0]:
        result["occurrence_to_issue_id"] = {}
        for occurrence in transformed_results[2]:
            if occurrence["event_id"] == result["id"]:
                result["occurrence_to_issue_id"][occurrence["occurrence_id"]] = occurrence[
                    "issue.ids"
                ]
        result["issue.ids"] = occurrence_issue_ids.get(result["id"], [])
        result["occurrence_id"] = occurrence_ids.get(result["id"], [])
        result["trace.parent_transaction"] = None
        if use_spans:
            result["measurements"] = {
                key: {
                    "value": value,
                    "type": transaction_query.get_field_type(f"measurements.{key}"),
                }
                for key, value in zip(result["measurements.key"], result["measurements.value"])
            }

    # Snuba responses aren't typed
    return cast(Sequence[SnubaTransaction], transformed_results[0]), cast(
        Sequence[SnubaError], transformed_results[1]
    )


def strip_span_id(span_id):
    """Span ids are stored as integers in snuba to save space, but this means if the span id has a 00 prefix the
    returned value is different

        Need to do this with a while loop cause doing hex(int(span_id, 16)) will turn something like 0abc into abc which
        differs from the behaviour we're seeing when clickhouse does it
    """
    result = span_id
    while result.startswith("00"):
        result = result.removeprefix("00")
    return result


def build_span_query(trace_id: str, spans_params: SnubaParams, query_spans: list[str]):
    parents_query = SpansIndexedQueryBuilder(
        Dataset.SpansIndexed,
        params={},
        snuba_params=spans_params,
        query=f"trace:{trace_id}",
        selected_columns=[
            "transaction.id",
            "span_id",
            "precise.start_ts",
            "precise.finish_ts",
        ],
        # Don't add an orderby here that way if clickhouse hits the # of span_ids we've asked for it'll exit early
        limit=len(query_spans),
    )
    # Performance improvement, snuba's parser is extremely slow when we're sending thousands of
    # span_ids here, using a `splitByChar` means that snuba will not parse the giant list of spans
    span_minimum = options.get("performance.traces.span_query_minimum_spans")
    sentry_sdk.set_measurement("trace_view.spans.span_minimum", span_minimum)
    sentry_sdk.set_tag("trace_view.split_by_char.optimization", len(query_spans) > span_minimum)
    if len(query_spans) > span_minimum:
        # TODO: because we're not doing an IN on a list of literals, snuba will not optimize the query with the HexInt
        # column processor which means we won't be taking advantage of the span_id index but if we only do this when we
        # have a lot of query_spans we should have a great performance improvement still once we do that we can simplify
        # this code and always apply this optimization
        span_condition_value = Function(
            "splitByChar", [",", ",".join(strip_span_id(span_id) for span_id in query_spans)]
        )
    else:
        span_condition_value = Function("tuple", list(query_spans))
    # Building the condition manually, a performance optimization since we might put thousands of span ids
    # and this way we skip both parsimonious and the builder
    parents_query.add_conditions(
        [Condition(Column(parents_query.resolve_column_name("id")), Op.IN, span_condition_value)]
    )
    return parents_query


def pad_span_id(span):
    """Snuba might return the span id without leading 0s since they're stored as UInt64
    which means a span like 0011 gets converted to an int, then back so we'll get `11` instead"""
    return span.rjust(16, "0")


@sentry_sdk.tracing.trace
def augment_transactions_with_spans(
    transactions: Sequence[SnubaTransaction],
    errors: Sequence[SnubaError],
    trace_id: str,
    params: SnubaParams,
    query_source: QuerySource | None = QuerySource.SENTRY_BACKEND,
) -> Sequence[SnubaTransaction]:
    """Augment the list of transactions with parent, error and problem data"""
    with sentry_sdk.start_span(op="augment.transactions", name="setup"):
        trace_parent_spans = set()  # parent span ids of segment spans
        transaction_problem_map: dict[str, SnubaTransaction] = {}
        problem_project_map: dict[int, list[str]] = {}
        issue_occurrences = []
        occurrence_spans: set[str] = set()
        error_spans = set()
        projects = set()
        for error in errors:
            if "trace.span" in error:
                error["trace.span"] = pad_span_id(error["trace.span"])
                error_spans.add(error["trace.span"])
            projects.add(error["project.id"])
        ts_params = find_timestamp_params(transactions)
        time_buffer = options.get("performance.traces.span_query_timebuffer_hours")
        sentry_sdk.set_measurement("trace_view.spans.time_buffer", time_buffer)
        if ts_params["min"]:
            params.start = ts_params["min"] - timedelta(hours=time_buffer)
        if ts_params["max"]:
            params.end = ts_params["max"] + timedelta(hours=time_buffer)

        if ts_params["max"] and ts_params["min"]:
            sentry_sdk.set_measurement(
                "trace_view.trace_duration", (ts_params["max"] - ts_params["min"]).total_seconds()
            )
            sentry_sdk.set_tag("trace_view.missing_timestamp_constraints", False)
        else:
            sentry_sdk.set_tag("trace_view.missing_timestamp_constraints", True)

    with sentry_sdk.start_span(op="augment.transactions", name="get transaction span ids"):
        for index, transaction in enumerate(transactions):
            transaction["occurrence_spans"] = []
            transaction["issue_occurrences"] = []

            project = transaction["project.id"]
            projects.add(project)

            # Pull out occurrence data
            transaction_problem_map[transaction["id"]] = transaction
            if project not in problem_project_map:
                problem_project_map[project] = []
            if transaction["occurrence_id"] is not None:
                problem_project_map[project].extend(transaction["occurrence_id"])

            if not transaction["trace.parent_span"]:
                continue
            # parent span ids of the segment spans
            trace_parent_spans.add(transaction["trace.parent_span"])

    with sentry_sdk.start_span(op="augment.transactions", name="get perf issue span ids"):
        for problem_project, occurrences in problem_project_map.items():
            if occurrences:
                issue_occurrences.extend(
                    [
                        occurrence
                        for occurrence in IssueOccurrence.fetch_multi(occurrences, problem_project)
                        if occurrence is not None
                    ]
                )

        for problem in issue_occurrences:
            occurrence_spans = occurrence_spans.union(
                set(problem.evidence_data["offender_span_ids"])
            )

    with sentry_sdk.start_span(op="augment.transactions", name="create query params"):
        query_spans = {*trace_parent_spans, *error_spans, *occurrence_spans}
        if "" in query_spans:
            query_spans.remove("")
        # If there are no spans to query just return transactions as is
        if len(query_spans) == 0:
            return transactions

        # Fetch parent span ids of segment spans and their corresponding
        # transaction id so we can link parent/child transactions in
        # a trace.
        spans_params = params.copy()
        spans_params.projects = [p for p in params.projects if p.id in projects]

    # If we're querying over 100 span ids, lets split the query into 3
    sentry_sdk.set_tag("trace_view.use_spans.span_len", len(query_spans))

    # Whether any of the span queries hit their query limit, which means that clickhouse would've exited early
    # this is for tagging so we can see the performance difference
    hit_limit = False
    # The max query size according to snuba/clickhouse docs is 256KiB, or about 256 thousand characters
    # Each span id maps to being 20 characters; 16 characters turned back into a number maxes out at 20
    # which at 10k transaction span ids, and even another 10k error span ids (which would only happen if there's no
    # crossover) that's 20k * 20 = 400k bytes, with 3 queries that should be 133,333 bytes  which shouldn't be anywhere
    # near the 256KiB max even with the other parts of the query.
    # Experimentally (running queries in snuba admin) we've found the max query size is actually 131,535 bytes or
    # 128.45KiB. Taking that into account, (131,535-10,000(for projects etc))/20 = 6000, means that we can fit at most
    # 6000 span ids per query, Adding a bit of a buffer, if the query is for more than 12,500 spans we'll do 4 chunks
    # instead of 3
    if len(query_spans) > 100:
        list_spans = list(query_spans)
        if len(query_spans) < 12_500:
            total_chunks = 3
        else:
            total_chunks = 4
        sentry_sdk.set_measurement("trace_view.span_query.total_chunks", total_chunks)
        chunks = chunked(list_spans, (len(list_spans) // total_chunks) + 1)
        queries = [build_span_query(trace_id, spans_params, chunk) for chunk in chunks]
        results = bulk_snuba_queries(
            [query.get_snql_query() for query in queries],
            referrer=Referrer.API_TRACE_VIEW_GET_PARENTS.value,
            query_source=query_source,
        )
        parents_results = results[0]
        for result, query in zip(results, queries):
            if len(result["data"]) == query.limit.limit:
                hit_limit = True
        for result in results[1:]:
            parents_results["data"].extend(result["data"])
    else:
        parents_query = build_span_query(trace_id, spans_params, list(query_spans))
        parents_results = parents_query.run_query(
            referrer=Referrer.API_TRACE_VIEW_GET_PARENTS.value,
            query_source=query_source,
        )
        if len(parents_results) == parents_query.limit.limit:
            hit_limit = True
    sentry_sdk.set_tag("trace_view.span_query.hit_limit", hit_limit)

    parent_map = {}
    if "data" in parents_results:
        for parent in parents_results["data"]:
            parent["span_id"] = pad_span_id(parent["span_id"])
            parent_map[parent["span_id"]] = parent

    with sentry_sdk.start_span(op="augment.transactions", name="linking transactions"):
        for transaction in transactions:
            # For a given transaction, if parent span id exists in the tranaction (so this is
            # not a root span), see if the indexed spans data can tell us what the parent
            # transaction id is.
            if "trace.parent_span" in transaction:
                parent = parent_map.get(transaction["trace.parent_span"])
                if parent is not None:
                    transaction["trace.parent_transaction"] = parent["transaction.id"]
    with sentry_sdk.start_span(op="augment.transactions", name="linking perf issues"):
        for problem in issue_occurrences:
            for span_id in problem.evidence_data["offender_span_ids"]:
                parent = parent_map.get(span_id)
                if parent is not None:
                    transaction_problem = transaction_problem_map[problem.event_id]
                    occurrence = parent.copy()
                    occurrence["problem"] = problem
                    transaction_problem["occurrence_spans"].append(occurrence)
    with sentry_sdk.start_span(op="augment.transactions", name="linking errors"):
        for error in errors:
            parent = parent_map.get(error["trace.span"])
            error["trace.transaction"] = parent["transaction.id"] if parent is not None else None
    return transactions


class OrganizationEventsTraceEndpointBase(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    snuba_methods = ["GET"]

    def get_projects(
        self,
        request: HttpRequest,
        organization: Organization | RpcOrganization,
        force_global_perms: bool = False,
        include_all_accessible: bool = False,
        project_ids: set[int] | None = None,
        project_slugs: set[str] | None = None,
    ) -> list[Project]:
        """The trace endpoint always wants to get all projects regardless of what's passed into the API

        This is because a trace can span any number of projects in an organization. But we still want to
        use the get_projects function to check for any permissions. So we'll just pass project_ids=-1 everytime
        which is what would be sent if we wanted all projects"""
        return super().get_projects(
            request,
            organization,
            project_ids={-1},
            project_slugs=None,
            include_all_accessible=True,
        )

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
            "message": event["message"],
            "timestamp": datetime.fromisoformat(event["timestamp"]).timestamp(),
            "event_type": "error",
            "generation": 0,
        }

    @staticmethod
    def construct_parent_map(
        events: Sequence[SnubaTransaction],
    ) -> dict[str, list[SnubaTransaction]]:
        """A mapping of span ids to their transactions

        - Transactions are associated to each other via parent_span_id
        """
        parent_map: dict[str, list[SnubaTransaction]] = defaultdict(list)
        for item in events:
            if not is_root(item):
                parent_map[item["trace.parent_span"]].append(item)
        return parent_map

    @staticmethod
    def construct_error_map(events: Sequence[SnubaError]) -> dict[str, list[SnubaError]]:
        """A mapping of span ids to their errors

        key depends on the event type:
        - Errors are associated to transactions via span_id
        """
        parent_map: dict[str, list[SnubaError]] = defaultdict(list)
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
            projects: set[int] = set()
            for transaction in transactions:
                projects.add(transaction["project.id"])

            len_projects = len(projects)
            sentry_sdk.set_tag("trace_view.projects", len_projects)
            sentry_sdk.set_tag("trace_view.projects.grouped", format_grouped_length(len_projects))
            set_measurement("trace_view.projects", len_projects)

    def get(self, request: Request, organization: Organization, trace_id: str) -> HttpResponse:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            # The trace view isn't useful without global views, so skipping the check here
            snuba_params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response(status=404)

        # Detailed is deprecated now that we want to use spans instead
        detailed = request.GET.get("detailed", "0") == "1"
        # Temporary url params until we finish migrating the frontend
        use_spans = request.GET.get("useSpans", "0") == "1"
        update_snuba_params_with_timestamp(request, snuba_params)

        sentry_sdk.set_tag("trace_view.using_spans", str(use_spans))
        if detailed and use_spans:
            raise ParseError("Cannot return a detailed response while using spans")
        limit = min(int(request.GET.get("limit", MAX_TRACE_SIZE)), 10_000)
        event_id = (
            request.GET.get("targetId") or request.GET.get("event_id") or request.GET.get("eventId")
        )

        # Only need to validate event_id as trace_id is validated in the URL
        if event_id and not (is_event_id(event_id) or is_span_id(event_id)):
            return Response({"detail": INVALID_ID_DETAILS.format("Event ID")}, status=400)

        query_source = self.get_request_source(request)
        with handle_query_errors():
            transaction_params = create_transaction_params(
                trace_id, snuba_params, query_source=query_source
            )

            if use_spans:
                transactions, errors = query_trace_data(
                    trace_id,
                    snuba_params,
                    transaction_params,
                    limit,
                    event_id,
                    use_spans,
                    query_source=query_source,
                )
                transactions = augment_transactions_with_spans(
                    transactions,
                    errors,
                    trace_id,
                    snuba_params,
                    query_source=query_source,
                )
            else:
                transactions, errors = query_trace_data(
                    trace_id,
                    snuba_params,
                    transaction_params,
                    limit,
                    None,
                    False,
                    query_source=query_source,
                )
            self.record_analytics(transactions, trace_id, self.request.user.id, organization.id)

        warning_extra: dict[str, str] = {"trace": trace_id, "organization": organization.slug}

        # Look for all root transactions in the trace (i.e., transactions
        # that explicitly have no parent span id)
        roots: list[SnubaTransaction] = []
        for item in transactions:
            if is_root(item):
                roots.append(item)
            else:
                # This is okay because the query does an order by on -root
                break
        if len(roots) > 1:
            sentry_sdk.set_tag("discover.trace-view.warning", "root.extra-found")
            logger.warning(
                "discover.trace-view.root.extra-found",
                extra={"extra_roots": len(roots), **warning_extra},
            )

        return Response(
            self.serialize(
                limit,
                transactions,
                errors,
                roots,
                warning_extra,
                event_id,
                detailed,
                use_spans,
                query_source=self.get_request_source(request),
            )
        )

    @abc.abstractmethod
    def serialize(
        self,
        limit: int,
        transactions: Sequence[SnubaTransaction],
        errors: Sequence[SnubaError],
        roots: Sequence[SnubaTransaction],
        warning_extra: dict[str, str],
        event_id: str | None,
        detailed: bool = False,
        use_spans: bool = False,
        query_source: QuerySource | None = None,
    ) -> Any:
        raise NotImplementedError


@region_silo_endpoint
class OrganizationEventsTraceLightEndpoint(OrganizationEventsTraceEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @staticmethod
    def get_current_transaction(
        transactions: Sequence[SnubaTransaction],
        errors: Sequence[SnubaError],
        event_id: str,
    ) -> tuple[SnubaTransaction | None, Event | GroupEvent | None]:
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
            return transaction_event, eventstore.backend.get_event_by_id(
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
                return transaction_event, eventstore.backend.get_event_by_id(
                    transaction_event["project.id"], transaction_event["id"]
                )
            # We didn't get lucky, time to talk to nodestore...
            for transaction_event in transactions:
                if transaction_event["transaction"] != error_event["transaction"]:
                    continue

                nodestore_event = eventstore.backend.get_event_by_id(
                    transaction_event["project.id"], transaction_event["id"]
                )
                if nodestore_event is None:
                    return None, None
                transaction_spans: NodeSpans = nodestore_event.data.get("spans", [])
                for span in transaction_spans:
                    if span["span_id"] == error_event["trace.span"]:
                        return transaction_event, nodestore_event

        return None, None

    def serialize(
        self,
        limit: int,
        transactions: Sequence[SnubaTransaction],
        errors: Sequence[SnubaError],
        roots: Sequence[SnubaTransaction],
        warning_extra: dict[str, str],
        event_id: str | None,
        detailed: bool = False,
        use_spans: bool = False,
        query_source: QuerySource | None = None,
    ) -> dict[str, list[LightResponse | TraceError]]:
        """Because the light endpoint could potentially have gaps between root and event we return a flattened list"""
        if use_spans:
            raise ParseError(detail="useSpans isn't supported on the trace-light")
        if event_id is None:
            raise ParseError(detail="An event_id is required for the light trace")
        snuba_event, nodestore_event = self.get_current_transaction(transactions, errors, event_id)
        parent_map = self.construct_parent_map(transactions)
        error_map = self.construct_error_map(errors)
        trace_results: list[TraceEvent] = []
        current_generation: int | None = None
        root_id: str | None = None

        with sentry_sdk.start_span(op="building.trace", name="light trace"):
            # Check if the event is an orphan_error
            if not snuba_event or not nodestore_event:
                orphan_error = find_event(
                    errors, lambda item: item is not None and item["id"] == event_id
                )
                if orphan_error:
                    return {
                        "transactions": [],
                        "orphan_errors": [self.serialize_error(orphan_error)],
                    }
                else:
                    # The current event couldn't be found in errors or transactions
                    raise Http404()

            # Going to nodestore is more expensive than looping twice so check if we're on the root first
            for root in roots:
                if root["id"] == snuba_event["id"]:
                    current_generation = 0
                    break

            snuba_params = self.get_snuba_params(
                self.request, self.request.organization, check_global_views=False
            )
            if current_generation is None:
                for root in roots:
                    # We might not be necessarily connected to the root if we're on an orphan event
                    if root["id"] != snuba_event["id"]:
                        # Get the root event and see if the current event's span is in the root event
                        root_event = eventstore.backend.get_event_by_id(
                            root["project.id"], root["id"]
                        )
                        if root_event is None:
                            root_spans: NodeSpans = []
                        else:
                            root_spans = root_event.data.get("spans", [])
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
                                    snuba_params=snuba_params,
                                    query_source=query_source,
                                )
                            )
                            current_generation = 1
                            break

            current_event = TraceEvent(
                snuba_event,
                root_id,
                current_generation,
                True,
                snuba_params=snuba_params,
                query_source=query_source,
            )
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
                                snuba_params=snuba_params,
                                query_source=query_source,
                            )
                            for child_event in child_events
                        ]
                    )

        return {
            "transactions": [result.to_dict() for result in trace_results],
            "orphan_errors": [],
        }


@region_silo_endpoint
class OrganizationEventsTraceEndpoint(OrganizationEventsTraceEndpointBase):
    @staticmethod
    def update_children(event: TraceEvent, limit: int) -> None:
        """Updates the children of subtraces

        - Generation could be incorrect from orphans where we've had to reconnect back to an orphan event that's
          already been encountered
        - Sorting children events by timestamp
        """
        parents = [event]
        iteration = 0
        while parents and iteration < limit:
            iteration += 1
            parent = parents.pop()
            parent.children.sort(key=child_sort_key)
            for child in parent.children:
                child.generation = parent.generation + 1 if parent.generation is not None else None
                parents.append(child)

    # Concurrently fetches nodestore data to construct and return a dict mapping eventid of a txn
    # to the associated nodestore event.
    @staticmethod
    def nodestore_event_map(events: Sequence[SnubaTransaction]) -> dict[str, Event | GroupEvent]:
        event_map = {}
        with ThreadPoolExecutor(max_workers=20) as executor:
            future_to_event = {
                executor.submit(
                    eventstore.backend.get_event_by_id, event["project.id"], event["id"]
                ): event
                for event in events
            }

            for future in as_completed(future_to_event):
                event_id = future_to_event[future]["id"]
                nodestore_event = future.result()
                if nodestore_event is not None:
                    event_map[event_id] = nodestore_event

        return event_map

    def serialize(
        self,
        limit: int,
        transactions: Sequence[SnubaTransaction],
        errors: Sequence[SnubaError],
        roots: Sequence[SnubaTransaction],
        warning_extra: dict[str, str],
        event_id: str | None,
        detailed: bool = False,
        use_spans: bool = False,
        query_source: QuerySource | None = None,
    ) -> SerializedTrace:
        """For the full event trace, we return the results as a graph instead of a flattened list

        if event_id is passed, we prune any potential branches of the trace to make as few nodestore calls as
        possible
        """
        if use_spans:
            results = self.serialize_with_spans(
                limit,
                transactions,
                errors,
                roots,
                warning_extra,
                event_id,
                detailed,
                query_source=query_source,
            )
            return results

        # Code past here is deprecated, but must continue to exist until sentry installs in every possible environment
        # are storing span data, since that's the only way serialize_with_spans will work
        event_id_to_nodestore_event = self.nodestore_event_map(transactions)
        parent_map = self.construct_parent_map(transactions)
        error_map = self.construct_error_map(errors)
        parent_events: dict[str, TraceEvent] = {}
        results_map: dict[str | None, list[TraceEvent]] = defaultdict(list)
        to_check: Deque[SnubaTransaction] = deque()
        snuba_params = self.get_snuba_params(
            self.request, self.request.organization, check_global_views=False
        )
        # The root of the orphan tree we're currently navigating through
        orphan_root: SnubaTransaction | None = None
        if roots:
            results_map[None] = []
        for root in roots:
            root_event = TraceEvent(
                root, None, 0, snuba_params=snuba_params, query_source=query_source
            )
            parent_events[root["id"]] = root_event
            results_map[None].append(root_event)
            to_check.append(root)

        iteration = 0
        with sentry_sdk.start_span(op="building.trace", name="full trace"):
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
                        current_event,
                        None,
                        0,
                        snuba_params=snuba_params,
                        query_source=query_source,
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

                spans: NodeSpans = []
                previous_event_id = previous_event.event["id"]
                if previous_event_id in event_id_to_nodestore_event:
                    previous_event.fetched_nodestore = True
                    nodestore_event = event_id_to_nodestore_event[previous_event_id]
                    previous_event._nodestore_event = nodestore_event
                    spans = nodestore_event.data.get("spans", [])

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
                            (
                                previous_event.generation + 1
                                if previous_event.generation is not None
                                else None
                            ),
                            snuba_params=snuba_params,
                            query_source=query_source,
                        )
                        # Add this event to its parent's children
                        previous_event.children.append(parent_events[child_event["id"]])

                        to_check.append(child_event)
                # Limit iterations just to be safe
                iteration += 1
                if iteration > limit:
                    sentry_sdk.set_tag("discover.trace-view.warning", "surpassed-trace-limit")
                    logger.warning(
                        "discover.trace-view.surpassed-trace-limit",
                        extra=warning_extra,
                    )
                    break

        # We are now left with orphan errors in the error_map,
        # that we need to serialize and return with our results.
        orphan_errors: list[TraceError] = []
        if iteration < limit:
            for errors in error_map.values():
                for error in errors:
                    orphan_errors.append(self.serialize_error(error))
                    iteration += 1
                    if iteration > limit:
                        break
                if iteration > limit:
                    break

        trace_roots: list[TraceEvent] = []
        orphans: list[TraceEvent] = []
        for index, result in enumerate(results_map.values()):
            for subtrace in result:
                self.update_children(subtrace, limit)
            if index > 0 or len(roots) == 0:
                orphans.extend(result)
            elif len(roots) > 0:
                trace_roots = result
        # We sort orphans and roots separately because we always want the root(s) as the first element(s)
        trace_roots.sort(key=child_sort_key)
        orphans.sort(key=child_sort_key)
        orphan_errors = sorted(orphan_errors, key=lambda k: k["timestamp"])

        if len(orphans) > 0:
            sentry_sdk.set_tag("discover.trace-view.contains-orphans", "yes")
            logger.warning("discover.trace-view.contains-orphans", extra=warning_extra)

        serialized_transactions = []

        for trace in trace_roots:
            serialized_transaction = trace.full_dict(detailed)
            if serialized_transaction is not None:
                serialized_transactions.append(serialized_transaction)
        for orphan in orphans:
            serialized_orphan = orphan.full_dict(detailed)
            if serialized_orphan is not None:
                serialized_transactions.append(serialized_orphan)

        return {
            "transactions": serialized_transactions,
            "orphan_errors": [orphan for orphan in orphan_errors],
        }

    def serialize_with_spans(
        self,
        limit: int,
        transactions: Sequence[SnubaTransaction],
        errors: Sequence[SnubaError],
        roots: Sequence[SnubaTransaction],
        warning_extra: dict[str, str],
        event_id: str | None,
        detailed: bool = False,
        query_source: QuerySource | None = None,
    ) -> SerializedTrace:
        root_traces: list[TraceEvent] = []
        orphans: list[TraceEvent] = []
        orphan_event_ids: set[str] = set()
        orphan_errors: list[SnubaError] = []
        if detailed:
            raise ParseError("Cannot return a detailed response using Spans")

        with sentry_sdk.start_span(op="serialize", name="create parent map"):
            parent_to_children_event_map = defaultdict(list)
            serialized_transactions: list[TraceEvent] = []
            for transaction in transactions:
                parent_id = transaction["trace.parent_transaction"]
                serialized_transaction = TraceEvent(
                    transaction,
                    parent_id,
                    -1,
                    span_serialized=True,
                    query_source=query_source,
                )
                if parent_id is None:
                    if transaction["trace.parent_span"]:
                        orphans.append(serialized_transaction)
                        orphan_event_ids.add(serialized_transaction.event["id"])
                    else:
                        root_traces.append(serialized_transaction)
                else:
                    parent_to_children_event_map[parent_id].append(serialized_transaction)
                serialized_transactions.append(serialized_transaction)

        parent_error_map = defaultdict(list)
        for error in errors:
            if error.get("trace.transaction") is not None:
                parent_error_map[error["trace.transaction"]].append(self.serialize_error(error))
            else:
                orphan_errors.append(error)

        with sentry_sdk.start_span(op="serialize", name="associate children"):
            for trace_event in serialized_transactions:
                event_id = trace_event.event["id"]
                if event_id in parent_to_children_event_map:
                    children_events = parent_to_children_event_map.pop(event_id)
                    trace_event.children = sorted(children_events, key=child_sort_key)
                if event_id in parent_error_map:
                    trace_event.errors = sorted(
                        parent_error_map.pop(event_id), key=lambda k: k["timestamp"]
                    )

        with sentry_sdk.start_span(op="serialize", name="more orphans"):
            visited_transactions_ids: set[str] = {
                root_trace.event["id"] for root_trace in root_traces
            }
            for serialized_transaction in sorted(serialized_transactions, key=child_sort_key):
                if serialized_transaction.event["id"] not in visited_transactions_ids:
                    if serialized_transaction.event["id"] not in orphan_event_ids:
                        orphans.append(serialized_transaction)
                        orphan_event_ids.add(serialized_transaction.event["id"])
                    visited_transactions_ids.add(serialized_transaction.event["id"])
                    for child in serialized_transaction.children:
                        visited_transactions_ids.add(child.event["id"])

        with sentry_sdk.start_span(op="serialize", name="sort"):
            # Sort the results so they're consistent
            orphan_errors.sort(key=lambda k: k["timestamp"])
            root_traces.sort(key=child_sort_key)
            orphans.sort(key=child_sort_key)

        visited_transactions_in_serialization: set[str] = set()

        result_transactions: list[FullResponse] = []
        for trace in root_traces:
            if trace.event["id"] in visited_transactions_in_serialization:
                continue
            result_transaction = trace.full_dict(detailed, visited_transactions_in_serialization)
            if result_transaction is not None:
                result_transactions.append(result_transaction)
        for orphan in orphans:
            if orphan.event["id"] in visited_transactions_in_serialization:
                continue
            serialized_orphan = orphan.full_dict(detailed, visited_transactions_in_serialization)
            if serialized_orphan is not None:
                result_transactions.append(serialized_orphan)

        with sentry_sdk.start_span(op="serialize", name="to dict"):
            return {
                "transactions": result_transactions,
                "orphan_errors": [self.serialize_error(error) for error in orphan_errors],
            }


@region_silo_endpoint
class OrganizationEventsTraceMetaEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    snuba_methods = ["GET"]

    def get_projects(
        self,
        request: HttpRequest,
        organization: Organization | RpcOrganization,
        force_global_perms: bool = False,
        include_all_accessible: bool = False,
        project_ids: set[int] | None = None,
        project_slugs: set[str] | None = None,
    ) -> list[Project]:
        """The trace endpoint always wants to get all projects regardless of what's passed into the API

        This is because a trace can span any number of projects in an organization. But we still want to
        use the get_projects function to check for any permissions. So we'll just pass project_ids=-1 everytime
        which is what would be sent if we wanted all projects"""
        return super().get_projects(
            request,
            organization,
            project_ids={-1},
            project_slugs=None,
            include_all_accessible=True,
        )

    def get(self, request: Request, organization: Organization, trace_id: str) -> HttpResponse:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            # The trace meta isn't useful without global views, so skipping the check here
            snuba_params = self.get_snuba_params(request, organization, check_global_views=False)
        except NoProjects:
            return Response(status=404)

        update_snuba_params_with_timestamp(request, snuba_params)
        query_source = self.get_request_source(request)
        meta_query = DiscoverQueryBuilder(
            dataset=Dataset.Discover,
            selected_columns=[
                "count_unique(project_id) as projects",
                "count_if(event.type, equals, transaction) as transactions",
                "count_if(event.type, notEquals, transaction) as errors",
            ],
            params={},
            snuba_params=snuba_params,
            query=f"trace:{trace_id}",
            limit=1,
        )
        transaction_children_query = SpansIndexedQueryBuilder(
            dataset=Dataset.SpansIndexed,
            selected_columns=[
                "transaction.id",
                "count()",
            ],
            orderby=["transaction.id"],
            params={},
            snuba_params=snuba_params,
            query=f"trace:{trace_id}",
            limit=10_000,
        )

        with handle_query_errors():
            results = bulk_snuba_queries(
                [
                    meta_query.get_snql_query(),
                    transaction_children_query.get_snql_query(),
                ],
                referrer=Referrer.API_TRACE_VIEW_GET_META.value,
                query_source=query_source,
            )
            meta_result, children_result = results[0], results[1]
            if len(meta_result["data"]) == 0:
                return Response(status=404)
            # Merge the result back into the first query
            meta_result["data"][0]["performance_issues"] = count_performance_issues(
                trace_id,
                snuba_params,
                query_source=query_source,
            )
        return Response(self.serialize(meta_result["data"][0], children_result["data"]))

    def serialize(self, results: Mapping[str, int], child_result: Any) -> Mapping[str, int]:
        return {
            # Values can be null if there's no result
            "projects": results.get("projects") or 0,
            "transactions": results.get("transactions") or 0,
            "errors": results.get("errors") or 0,
            "performance_issues": results.get("performance_issues") or 0,
            "transaction_child_count_map": child_result,
        }
