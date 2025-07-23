from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, NotRequired, TypedDict

import sentry_sdk
from snuba_sdk import Column, Function

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import run_trace_query
from sentry.utils.numbers import base32_encode

# 1 worker each for spans, errors, performance issues
_query_thread_pool = ThreadPoolExecutor(max_workers=3)

# Mostly here for testing
ERROR_LIMIT = 10_000


class SerializedEvent(TypedDict):
    description: str
    event_id: str
    event_type: str
    project_id: int
    project_slug: str
    transaction: str


class SerializedIssue(SerializedEvent):
    issue_id: int
    level: str
    start_timestamp: float
    end_timestamp: NotRequired[datetime]
    culprit: str | None
    short_id: str | None
    issue_type: str


class SerializedSpan(SerializedEvent):
    children: list["SerializedEvent"]
    errors: list["SerializedIssue"]
    occurrences: list["SerializedIssue"]
    duration: float
    end_timestamp: datetime
    measurements: dict[str, Any]
    op: str
    name: str
    parent_span_id: str | None
    profile_id: str
    profiler_id: str
    sdk_name: str
    start_timestamp: datetime
    is_transaction: bool
    transaction_id: str
    additional_attributes: NotRequired[dict[str, Any]]


def _serialize_rpc_issue(event: dict[str, Any], group_cache: dict[int, Group]) -> SerializedIssue:
    def _qualify_short_id(project: str, short_id: int | None) -> str | None:
        """Logic for qualified_short_id is copied from property on the Group model
        to prevent an N+1 query from accessing project.slug everytime"""
        if short_id is not None:
            return f"{project.upper()}-{base32_encode(short_id)}"
        else:
            return None

    if event.get("event_type") == "occurrence":
        occurrence = event["issue_data"]["occurrence"]
        span = event["span"]
        issue_id = event["issue_data"]["issue_id"]
        if issue_id in group_cache:
            issue = group_cache[issue_id]
        else:
            issue = Group.objects.get(id=issue_id, project__id=occurrence.project_id)
            group_cache[issue_id] = issue
        return SerializedIssue(
            event_id=occurrence.id,
            project_id=occurrence.project_id,
            project_slug=span["project.slug"],
            start_timestamp=span["precise.start_ts"],
            end_timestamp=span["precise.finish_ts"],
            transaction=span["transaction"],
            description=occurrence.issue_title,
            level=occurrence.level,
            issue_id=issue_id,
            event_type="occurrence",
            culprit=issue.culprit,
            short_id=_qualify_short_id(span["project.slug"], issue.short_id),
            issue_type=issue.type,
        )
    elif event.get("event_type") == "error":
        timestamp = (
            datetime.fromisoformat(event["timestamp_ms"]).timestamp()
            if "timestamp_ms" in event and event["timestamp_ms"] is not None
            else datetime.fromisoformat(event["timestamp"]).timestamp()
        )
        issue_id = event["issue.id"]
        if issue_id in group_cache:
            issue = group_cache[issue_id]
        else:
            issue = Group.objects.get(id=issue_id, project__id=event["project.id"])
            group_cache[issue_id] = issue

        return SerializedIssue(
            event_id=event["id"],
            project_id=event["project.id"],
            project_slug=event["project.name"],
            start_timestamp=timestamp,
            transaction=event["transaction"],
            description=event["message"],
            level=event["tags[level]"],
            issue_id=event["issue.id"],
            event_type="error",
            culprit=issue.culprit,
            short_id=_qualify_short_id(event["project.name"], issue.short_id),
            issue_type=issue.type,
        )
    else:
        raise Exception(f"Unknown event encountered in trace: {event.get('event_type')}")


def _serialize_rpc_event(
    event: dict[str, Any],
    group_cache: dict[int, Group],
    additional_attributes: list[str] | None = None,
) -> SerializedEvent | SerializedIssue:
    if event.get("event_type") == "span":
        attribute_dict = {
            attribute: event[attribute]
            for attribute in additional_attributes or []
            if attribute in event
        }
        return SerializedSpan(
            children=[
                _serialize_rpc_event(child, group_cache, additional_attributes)
                for child in event["children"]
            ],
            errors=[_serialize_rpc_issue(error, group_cache) for error in event["errors"]],
            occurrences=[
                _serialize_rpc_issue(error, group_cache) for error in event["occurrences"]
            ],
            event_id=event["id"],
            transaction_id=event["transaction.event_id"],
            project_id=event["project.id"],
            project_slug=event["project.slug"],
            profile_id=event["profile.id"],
            profiler_id=event["profiler.id"],
            parent_span_id=(
                None
                if not event["parent_span"] or event["parent_span"] == "0" * 16
                else event["parent_span"]
            ),
            start_timestamp=event["precise.start_ts"],
            end_timestamp=event["precise.finish_ts"],
            measurements={
                key: value for key, value in event.items() if key.startswith("measurements.")
            },
            duration=event["span.duration"],
            transaction=event["transaction"],
            is_transaction=event["is_transaction"],
            description=event["description"],
            sdk_name=event["sdk.name"],
            op=event["span.op"],
            name=event["span.name"],
            event_type="span",
            additional_attributes=attribute_dict,
        )
    else:
        return _serialize_rpc_issue(event, group_cache)


def _errors_query(
    snuba_params: SnubaParams, trace_id: str, error_id: str | None
) -> DiscoverQueryBuilder:
    """Run an error query, getting all the errors for a given trace id"""
    # TODO: replace this with EAP calls, this query is copied from the old trace view
    columns = [
        "id",
        "project.name",
        "project.id",
        "timestamp",
        "timestamp_ms",
        "trace.span",
        "transaction",
        "issue",
        "title",
        "message",
        "tags[level]",
    ]
    orderby = ["id"]
    # If there's an error_id included in the request, bias the orderby to try to return that error_id over others so
    # that we can render it in the trace view, even if we hit the error_limit
    if error_id is not None:
        columns.append(f'to_other(id, "{error_id}", 0, 1) AS target')
        orderby.insert(0, "-target")
    return DiscoverQueryBuilder(
        Dataset.Events,
        params={},
        snuba_params=snuba_params,
        query=f"trace:{trace_id}",
        selected_columns=columns,
        # Don't add timestamp to this orderby as snuba will have to split the time range up and make multiple queries
        orderby=orderby,
        limit=ERROR_LIMIT,
        config=QueryBuilderConfig(
            auto_fields=True,
        ),
    )


@sentry_sdk.tracing.trace
def _run_errors_query(errors_query: DiscoverQueryBuilder):
    result = errors_query.run_query(Referrer.API_TRACE_VIEW_GET_EVENTS.value)
    error_data = errors_query.process_results(result)["data"]
    for event in error_data:
        event["event_type"] = "error"
    return error_data


def _perf_issues_query(snuba_params: SnubaParams, trace_id: str) -> DiscoverQueryBuilder:
    occurrence_query = DiscoverQueryBuilder(
        Dataset.IssuePlatform,
        params={},
        snuba_params=snuba_params,
        query=f"trace:{trace_id}",
        selected_columns=["event_id", "occurrence_id", "project_id"],
        config=QueryBuilderConfig(
            functions_acl=["groupArray"],
        ),
    )
    occurrence_query.columns.extend(
        [
            Function("groupArray", parameters=[Column("group_id")], alias="issue.ids"),
        ]
    )
    occurrence_query.groupby = [
        Column("event_id"),
        Column("occurrence_id"),
        Column("project_id"),
    ]
    return occurrence_query


@sentry_sdk.tracing.trace
def _run_perf_issues_query(occurrence_query: DiscoverQueryBuilder):
    result = occurrence_query.run_query(Referrer.API_TRACE_VIEW_GET_EVENTS.value)
    occurrence_data = occurrence_query.process_results(result)["data"]

    occurrence_ids = defaultdict(list)
    occurrence_issue_ids = defaultdict(list)
    issue_occurrences = []
    for event in occurrence_data:
        event["event_type"] = "occurrence"
        occurrence_ids[event["project_id"]].append(event["occurrence_id"])
        occurrence_issue_ids[event["occurrence_id"]].extend(event["issue.ids"])
    for project_id, occurrence_list in occurrence_ids.items():
        issue_occurrences.extend(
            IssueOccurrence.fetch_multi(
                occurrence_list,
                project_id,
            )
        )
    result = []
    for issue in issue_occurrences:
        if issue:
            for issue_id in occurrence_issue_ids.get(issue.id, []):
                result.append({"occurrence": issue, "issue_id": issue_id})

    return result


def query_trace_data(
    snuba_params: SnubaParams,
    trace_id: str,
    error_id: str | None = None,
    additional_attributes: list[str] | None = None,
) -> list[SerializedEvent]:
    """Query SerializedEvent data for a given trace"""
    # This is a hack, long term EAP will store both errors and performance_issues eventually but is not ready
    # currently. But we want to move performance data off the old tables immediately. To keep the code simpler I'm
    # parallelizing the queries here, but ideally this parallelization lives in the spans_rpc module instead

    # There's a really subtle bug here where if the query builders were constructed within
    # the thread pool, database connections can hang around as the threads are not cleaned
    # up. Because of that, tests can fail during tear down as there are active connections
    # to the database preventing a DROP.
    errors_query = _errors_query(snuba_params, trace_id, error_id)
    occurrence_query = _perf_issues_query(snuba_params, trace_id)

    spans_future = _query_thread_pool.submit(
        run_trace_query,
        trace_id,
        snuba_params,
        Referrer.API_TRACE_VIEW_GET_EVENTS.value,
        SearchResolverConfig(),
        additional_attributes,
    )
    errors_future = _query_thread_pool.submit(
        _run_errors_query,
        errors_query,
    )
    occurrence_future = _query_thread_pool.submit(
        _run_perf_issues_query,
        occurrence_query,
    )

    spans_data = spans_future.result()
    errors_data = errors_future.result()
    occurrence_data = occurrence_future.result()

    result = []
    id_to_span = {event["id"]: event for event in spans_data}
    id_to_error: dict[str, Any] = {}
    for event in errors_data:
        id_to_error.setdefault(event["trace.span"], []).append(event)
    id_to_occurrence = defaultdict(list)
    with sentry_sdk.start_span(op="process.occurrence_data") as sdk_span:
        for event in occurrence_data:
            offender_span_ids = event["occurrence"].evidence_data.get("offender_span_ids", [])
            if len(offender_span_ids) == 0:
                sdk_span.set_data("evidence_data.empty", event["occurrence"].evidence_data)
            for span_id in offender_span_ids:
                id_to_occurrence[span_id].append(event)
    for span in spans_data:
        if span["parent_span"] in id_to_span:
            parent = id_to_span[span["parent_span"]]
            parent["children"].append(span)
        else:
            result.append(span)
        if span["id"] in id_to_error:
            errors = id_to_error.pop(span["id"])
            span["errors"].extend(errors)
        if span["id"] in id_to_occurrence:
            span["occurrences"].extend(
                [
                    {
                        "event_type": "occurrence",
                        "span": span,
                        "issue_data": occurrence,
                    }
                    for occurrence in id_to_occurrence[span["id"]]
                ]
            )
    for errors in id_to_error.values():
        result.extend(errors)
    group_cache: dict[int, Group] = {}
    return [_serialize_rpc_event(root, group_cache, additional_attributes) for root in result]
