import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, NotRequired, TypedDict

from sentry.uptime.subscriptions.regions import get_region_config

logger = logging.getLogger(__name__)

import sentry_sdk
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    TraceItemTableRequest,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter
from snuba_sdk import Column as SnubaColumn
from snuba_sdk import Function

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.search.eap.common_columns import COMMON_COLUMNS
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.eap.uptime_results.attributes import UPTIME_ATTRIBUTE_DEFINITIONS
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import QueryBuilderConfig, SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.uptime.eap_utils import get_columns_for_uptime_result
from sentry.utils.numbers import base32_encode
from sentry.utils.snuba_rpc import table_rpc

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


class SerializedUptimeCheck(SerializedEvent):
    children: list["SerializedEvent"]
    errors: list["SerializedIssue"]
    occurrences: list["SerializedIssue"]
    transaction_id: str
    op: str
    start_timestamp: float
    end_timestamp: float
    duration: float
    name: str
    region_name: str
    additional_attributes: dict[str, Any]


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
            event_id=occurrence.event_id,
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
) -> SerializedEvent | SerializedIssue | SerializedUptimeCheck:
    if event.get("event_type") not in ("span", "uptime_check"):
        return _serialize_rpc_issue(event, group_cache)

    attribute_dict = {
        attribute: event[attribute]
        for attribute in additional_attributes or []
        if attribute in event
    }
    children = [
        _serialize_rpc_event(child, group_cache, additional_attributes)
        for child in event["children"]
    ]
    errors = [_serialize_rpc_issue(error, group_cache) for error in event["errors"]]
    occurrences = [_serialize_rpc_issue(error, group_cache) for error in event["occurrences"]]

    if event.get("event_type") == "uptime_check":
        return SerializedUptimeCheck(
            children=children,
            errors=errors,
            occurrences=occurrences,
            event_type="uptime_check",
            event_id=event["event_id"],
            project_id=event["project_id"],
            project_slug=event["project_slug"],
            transaction=event["transaction"],
            transaction_id=event["transaction_id"],
            op=event["op"],
            name=event["name"],
            start_timestamp=event["start_timestamp"],
            end_timestamp=event["end_timestamp"],
            duration=event["duration"],
            description=event["description"],
            region_name=event["region_name"],
            additional_attributes=event["additional_attributes"],
        )

    return SerializedSpan(
        children=children,
        errors=errors,
        occurrences=occurrences,
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
            Function("groupArray", parameters=[SnubaColumn("group_id")], alias="issue.ids"),
        ]
    )
    occurrence_query.groupby = [
        SnubaColumn("event_id"),
        SnubaColumn("occurrence_id"),
        SnubaColumn("project_id"),
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


def _uptime_results_query(
    snuba_params: SnubaParams,
    trace_id: str,
) -> TraceItemTableRequest:
    """Build a TraceItemTableRequest to query uptime results for a given trace"""
    start_timestamp = Timestamp()
    if snuba_params.start:
        start_timestamp.FromDatetime(snuba_params.start)
    end_timestamp = Timestamp()
    if snuba_params.end:
        end_timestamp.FromDatetime(snuba_params.end)

    assert snuba_params.organization
    return TraceItemTableRequest(
        meta=RequestMeta(
            organization_id=snuba_params.organization.id,
            project_ids=snuba_params.project_ids,
            trace_item_type=TraceItemType.TRACE_ITEM_TYPE_UPTIME_RESULT,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            referrer="api.trace-view.get-uptime-results",
            downsampled_storage_config=DownsampledStorageConfig(
                mode=DownsampledStorageConfig.MODE_HIGHEST_ACCURACY
            ),
        ),
        columns=get_columns_for_uptime_result(),
        filter=TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(
                    name="sentry.trace_id",
                    type=AttributeKey.Type.TYPE_STRING,
                ),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str=trace_id),
            )
        ),
    )


def _run_uptime_results_query(uptime_query: TraceItemTableRequest) -> list[TraceItemTableResponse]:
    return table_rpc([uptime_query])


def _serialize_columnar_uptime_item(
    row_dict: dict[str, AttributeValue],
    project_slugs: dict[int, str],
) -> dict[str, Any]:
    """Convert a columnar uptime row to a serialized uptime check span format"""
    columns_by_name = {col.internal_name: col for col in UPTIME_ATTRIBUTE_DEFINITIONS.values()}
    common_column_names = {col.internal_name for col in COMMON_COLUMNS}

    trace_id = row_dict["sentry.trace_id"].val_str
    check_status = row_dict["check_status"].val_str
    request_url = row_dict["request_url"].val_str
    actual_check_time_us = row_dict["actual_check_time_us"].val_int
    check_duration_us = (
        row_dict["check_duration_us"].val_int if "check_duration_us" in row_dict else 0
    )
    project_id = row_dict["sentry.project_id"].val_int
    project_slug = project_slugs[project_id]

    item_id_str = row_dict["sentry.item_id"].val_str

    region_config = get_region_config(row_dict["region"].val_str)
    region_name = region_config.name if region_config else "Unknown"

    def get_value(attr_name: str, attr_value: AttributeValue):
        if attr_value.is_null:
            return None
        resolved_column = columns_by_name[attr_name]
        if resolved_column.search_type == "integer":
            return attr_value.val_int
        elif resolved_column.search_type == "string":
            return attr_value.val_str
        elif resolved_column.search_type == "number":
            return attr_value.val_double
        elif resolved_column.search_type == "boolean":
            return attr_value.val_bool
        elif resolved_column.search_type == "byte":
            return attr_value.val_int
        raise ValueError("Unknown column type")

    additional_attrs = {}
    for attr_name, attr_value in row_dict.items():
        if attr_name in columns_by_name and attr_name not in common_column_names:
            resolved_column = columns_by_name[attr_name]
            resolved_val = get_value(attr_name, attr_value)
            if resolved_val is not None:
                additional_attrs[resolved_column.public_alias] = resolved_val

    uptime_check = {
        "event_type": "uptime_check",
        "event_id": item_id_str,
        "project_id": project_id,
        "project_slug": project_slug,
        "transaction": "uptime.check",
        "transaction_id": trace_id,
        "name": request_url,
        "op": "uptime.request",
        "start_timestamp": actual_check_time_us / 1_000_000,
        "end_timestamp": (actual_check_time_us + check_duration_us) / 1_000_000,
        "duration": check_duration_us / 1_000.0,
        "description": f"Uptime Check Request [{check_status}]",
        "region_name": region_name,
        "additional_attributes": additional_attrs,
        "children": [],
        "errors": [],
        "occurrences": [],
    }

    return uptime_check


@sentry_sdk.tracing.trace
def query_trace_data(
    snuba_params: SnubaParams,
    trace_id: str,
    error_id: str | None = None,
    additional_attributes: list[str] | None = None,
    include_uptime: bool = False,
    referrer: Referrer = Referrer.API_TRACE_VIEW_GET_EVENTS,
) -> list[SerializedEvent]:
    """Queries span/error data for a given trace"""
    # This is a hack, long term EAP will store both errors and performance_issues eventually but is not ready
    # currently. But we want to move performance data off the old tables immediately. To keep the code simpler I'm
    # parallelizing the queries here, but ideally this parallelization lives in the spans_rpc module instead

    # There's a really subtle bug here where if the query builders were constructed within
    # the thread pool, database connections can hang around as the threads are not cleaned
    # up. Because of that, tests can fail during tear down as there are active connections
    # to the database preventing a DROP.
    errors_query = _errors_query(snuba_params, trace_id, error_id)
    occurrence_query = _perf_issues_query(snuba_params, trace_id)
    uptime_query = _uptime_results_query(snuba_params, trace_id) if include_uptime else None

    # 1 worker each for spans, errors, performance issues, and optionally uptime
    max_workers = 4 if include_uptime else 3
    query_thread_pool = ThreadPoolExecutor(thread_name_prefix=__name__, max_workers=max_workers)
    with query_thread_pool:
        spans_future = query_thread_pool.submit(
            Spans.run_trace_query,
            trace_id=trace_id,
            params=snuba_params,
            referrer=referrer.value,
            config=SearchResolverConfig(),
            additional_attributes=additional_attributes,
        )
        errors_future = query_thread_pool.submit(
            _run_errors_query,
            errors_query,
        )
        occurrence_future = query_thread_pool.submit(
            _run_perf_issues_query,
            occurrence_query,
        )
        uptime_future = None
        if include_uptime and uptime_query:
            uptime_future = query_thread_pool.submit(_run_uptime_results_query, uptime_query)

    spans_data = spans_future.result()
    errors_data = errors_future.result()
    occurrence_data = occurrence_future.result()
    uptime_data = uptime_future.result() if uptime_future else []
    result: list[dict[str, Any]] = []
    root_span: dict[str, Any] | None = None

    # If uptime checks are present re-parent the existing root span to the
    # uptime check that initiated the trace.
    if uptime_data:
        trace_items = []
        for response in uptime_data:
            column_values = response.column_values
            if not column_values:
                continue
            column_names = [cv.attribute_name for cv in column_values]
            num_rows = len(column_values[0].results)
            for row_idx in range(num_rows):
                row_dict = {}
                for col_idx, col_name in enumerate(column_names):
                    attr_value = column_values[col_idx].results[row_idx]
                    row_dict[col_name] = attr_value
                trace_items.append(row_dict)

        if trace_items:
            project_slugs = {
                p["id"]: p["slug"]
                for p in Project.objects.filter(id__in=snuba_params.project_ids).values(
                    "id", "slug"
                )
            }
            uptime_checks = [
                _serialize_columnar_uptime_item(item, project_slugs) for item in trace_items
            ]
            uptime_checks.sort(
                key=lambda s: s.get("additional_attributes", {}).get("request_sequence", 0)
            )
            root_span = uptime_checks[-1]
            result.extend(uptime_checks)

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
    with sentry_sdk.start_span(op="process.trace_data"):
        for span in spans_data:
            if span["parent_span"] in id_to_span:
                parent = id_to_span[span["parent_span"]]
                parent["children"].append(span)
            elif root_span:
                span["parent_span"] = root_span.get("event_id", root_span.get("id"))
                root_span["children"].append(span)
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
    with sentry_sdk.start_span(op="process.errors_data"):
        for errors in id_to_error.values():
            result.extend(errors)
    group_cache: dict[int, Group] = {}
    with sentry_sdk.start_span(op="serializing_data"):
        return [_serialize_rpc_event(root, group_cache, additional_attributes) for root in result]
