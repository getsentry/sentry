from collections import defaultdict
from datetime import datetime, timedelta, timezone

from rest_framework.request import Request
from rest_framework.response import Response
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME
from snuba_sdk import Column

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.search.events.builder.spans_indexed import SpansIndexedQueryBuilder
from sentry.search.events.types import ParamsType
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer


@region_silo_endpoint
class OrganizationTransactionDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.PERFORMANCE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization, project_slug, transaction_id):
        try:
            project = Project.objects.get(
                slug=project_slug, organization_id=organization.id, status=ObjectStatus.ACTIVE
            )
        except Project.DoesNotExist:
            return Response(status=404)

        # Check access to the project as this endpoint doesn't use membership checks done
        # get_filter_params().
        if not request.access.has_project_access(project):
            return Response(status=404)

        # Get a list of all spans with this transaction_id
        start = request.GET.get("start_timestamp")
        end = request.GET.get("end_timestamp")

        spans_data = _query_all_spans_in_transaction(
            organization, project, transaction_id, start, end
        )
        if len(spans_data) == 0:
            return Response(status=404)

        segment_span = next((span for span in spans_data if span["is_segment"] != 0), None)
        if segment_span is None:
            return Response({"detail": "No segment span found"}, status=500)

        spans_data = list(
            filter(lambda span: span["span_id"] != segment_span["span_id"], spans_data)
        )

        segment_tags_items = zip(segment_span["tags.key"], segment_span["tags.value"])
        segment_sentry_tags = dict(
            zip(segment_span["sentry_tags.key"], segment_span["sentry_tags.value"])
        )
        segment_measurements = dict(
            zip(segment_span["measurements.key"], segment_span["measurements.value"])
        )

        transaction_name = segment_sentry_tags.get("transaction")
        parent_span_id = segment_span.get("parent_span_id", None)
        if parent_span_id == "00":
            parent_span_id = None

        # Assemble them into the same format as the event details endpoint
        return Response(
            {
                "event_id": transaction_id,
                "project": project.id,
                "release": segment_sentry_tags.get("release"),
                "dist": None,
                "platform": segment_span.get("platform"),  # column is always null in Clickhouse
                "message": "",
                "datetime": datetime.fromtimestamp(
                    segment_span.get("precise.start_ts"), tz=timezone.utc
                ).isoformat(),
                "tags": list(segment_tags_items) + list(segment_sentry_tags.items()),
                "_meta": {},
                "_metrics": {},
                "breakdowns": {
                    "span_ops": _span_ops_breakdown(spans_data),
                },
                "contexts": {
                    "browser": {
                        "name": segment_sentry_tags.get("browser.name"),
                        # other props missing from indexed spans dataset
                    },
                    "organization": {
                        # missing from indexed spans dataset
                    },
                    "os": {
                        "name": segment_sentry_tags.get("os.name"),
                        # other props missing from indexed spans dataset
                    },
                    "trace": {
                        "trace_id": segment_span.get("trace_id"),
                        "span_id": segment_span.get("span_id"),
                        "parent_span_id": parent_span_id,
                        "op": segment_span.get("op"),
                        "status": SPAN_STATUS_CODE_TO_NAME[segment_span.get("status", 2)],
                        "exclusive_time": segment_span.get("exclusive_time"),
                        "hash": segment_span.get("group"),
                        "type": "trace",
                    },
                },
                "culprit": transaction_name,
                "environment": segment_sentry_tags.get("environment"),
                "errors": [],
                "extra": {},
                "ingest_path": [],
                "level": "info",
                "location": transaction_name,
                "logger": "",
                "measurements": segment_measurements,
                "metadata": {
                    "location": transaction_name,
                    "title": transaction_name,
                },
                "nodestore_insert": segment_span.get("precise.finish_ts"),
                "received": segment_span.get("precise.finish_ts"),
                "request": {
                    # missing from indexed spans dataset
                },
                "sdk": {
                    "name": segment_sentry_tags.get("sdk.name"),
                    "version": segment_sentry_tags.get("sdk.version"),
                    # other props missing from indexed spans dataset
                },
                "span_grouping_config": {
                    # missing from indexed spans dataset
                },
                "spans": _span_data_to_event_spans(spans_data),
                "start_timestamp": segment_span.get("precise.start_ts"),
                "timestamp": segment_span.get("precise.finish_ts"),
                "title": transaction_name,
                "transaction": transaction_name,
                "transaction_info": {
                    # missing from indexed spans dataset
                },
                "type": "transaction",
                "user": {
                    # missing from indexed spans dataset
                },
                "version": 5,
            },
            status=200,
        )


def _query_all_spans_in_transaction(
    organization, project, transaction_id, given_start_str, given_end_str
):
    # If we were given a time range by the client, use that time range.
    try:
        given_start = datetime.fromtimestamp(float(given_start_str))
        given_end = datetime.fromtimestamp(float(given_end_str))
    except TypeError:
        given_start = None
        given_end = None

    if given_start and given_end:
        return _query_spans_in_range(organization, project, transaction_id, given_start, given_end)

    # We don't know when these spans occurred and it takes too long to
    # search without a fairly narrow time range. Search progressively
    # farther and farther back until we find the spans.
    now = datetime.now()
    all_spans_data = []

    for days_back in range(0, 90):
        start = now - timedelta(days=days_back + 1)
        end = now - timedelta(days=days_back)
        spans_data = _query_spans_in_range(organization, project, transaction_id, start, end)
        if spans_data:
            all_spans_data.extend(spans_data)
        # Assume we've found all the spans if we get an empty result back after already finding some
        if not spans_data and all_spans_data:
            break

    return all_spans_data


def _query_spans_in_range(organization, project, transaction_id, start, end):
    params: ParamsType = {
        "start": start,
        "end": end,
        "project_id": [project.id],
        "project_objects": [project],
        "organization_id": organization.id,
    }

    # Look up the spans for this transaction
    query = SpansIndexedQueryBuilder(
        Dataset.SpansIndexed,
        params,
        query=f"transaction_id:{transaction_id}",
        selected_columns=[
            "transaction_id",
            "transaction_op",
            "trace_id",
            "span_id",
            "profile_id",
            "parent_span_id",
            "segment_id",
            "segment_name",
            "precise.start_ts",
            "precise.finish_ts",
            "exclusive_time",
            "op",
            "group",
            "span_status",
            "span_kind",
            "description",
            "status",
            "platform",
            "user",
            "measurements.key",
            "measurements.value",
        ],
        orderby=["precise.start_ts", "id"],
        limit=10000,
    )
    # These columns are incorrectly translated by the query builder - add
    # them directly as a workaround
    query.columns += [
        Column("is_segment"),
        Column("tags.key"),
        Column("tags.value"),
        Column("sentry_tags.key"),
        Column("sentry_tags.value"),
    ]
    results = query.run_query(referrer=Referrer.API_ORGANIZATION_TRANSACTION_DETAILS.value)
    return results["data"]


def _span_data_to_event_spans(span_data):
    return [
        {
            "timestamp": span["precise.finish_ts"],
            "start_timestamp": span["precise.start_ts"],
            "exclusive_time": span["exclusive_time"],
            "description": span["description"],
            "op": span["op"],
            "span_id": span["span_id"],
            "parent_span_id": span["parent_span_id"],
            "trace_id": span["trace_id"],
            "tags": dict(zip(span["tags.key"], span["tags.value"])),
            "sentry_tags": dict(zip(span["sentry_tags.key"], span["sentry_tags.value"])),
            "hash": span["group"],
            "same_process_as_parent": span.get("same_process_as_parent"),
        }
        for span in span_data
    ]


def _span_ops_breakdown(spans_data):
    # Roughly replicates the logic in Relay. See:
    # https://github.com/getsentry/relay/blob/b2fcde7ddb829e53f8b312bc25b2dc24eaae3b84/relay-event-normalization/src/normalize/breakdowns.rs#L87
    known_ops = {"db", "http", "resource", "browser", "ui"}
    intervals_by_op = defaultdict(list)

    for span in spans_data:
        # Normalize known span ops, since those get reported individualy
        span_op = span.get("op", "")
        for op in known_ops:
            if span_op.startswith(op):
                span_op = op
                break

        intervals_by_op[span_op].append(
            (span.get("precise.start_ts"), span.get("precise.finish_ts"))
        )

    total_time = 0.0
    breakdown = {}
    for op, intervals in intervals_by_op.items():
        duration = _duration_from_intervals(intervals)
        total_time += duration
        if op in known_ops:
            breakdown[f"ops.{op}"] = {
                "value": round(duration, 3),
                "unit": "milliseconds",
            }

    breakdown["total.time"] = {
        "value": round(total_time, 3),
        "unit": "milliseconds",
    }
    return breakdown


def _duration_from_intervals(intervals):
    intervals.sort(key=lambda x: x[0])

    duration = 0.0
    i = 0
    while i < len(intervals):
        start, end = intervals[i]
        for j in range(i, len(intervals)):
            next_span_start, next_span_end = intervals[j]
            if next_span_start < end:
                end = next_span_end
                i = j
        duration += (end - start) * 1000.0  # convert to ms
        i += 1

    return duration
