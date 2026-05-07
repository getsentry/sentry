from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from google.protobuf.json_format import MessageToJson, ParseDict
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageConfig
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import Column, TraceItemTableRequest
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    ExtrapolationMode,
    Function,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

DEFAULT_REFERRER = "dynamic_sampling.per_org.get_eap_org_volume"
DEFAULT_SPEC_PATH = Path(__file__).with_name("eap_rpc_specs") / "get_eap_org_volume.json"


def get_attribute_key(column: str) -> AttributeKey:
    if column in {"project.id", "project_id"}:
        return AttributeKey(type=AttributeKey.TYPE_INT, name="sentry.project_id")
    if column == "transaction":
        return AttributeKey(type=AttributeKey.TYPE_STRING, name="sentry.transaction")
    if column == "is_transaction":
        return AttributeKey(type=AttributeKey.TYPE_BOOLEAN, name="sentry.is_segment")
    raise ValueError(f"Unsupported shortcut column: {column}")


def get_count_key(column: str) -> AttributeKey:
    if column == "count()":
        return AttributeKey(type=AttributeKey.TYPE_INT, name="sentry.project_id")
    if column == "count_sample()":
        return AttributeKey(type=AttributeKey.TYPE_DOUBLE, name="sentry.duration_ms")
    raise ValueError(f"Unsupported aggregate shortcut: {column}")


def get_extrapolation_mode(column: str) -> ExtrapolationMode.ValueType:
    if column == "count_sample()":
        return ExtrapolationMode.EXTRAPOLATION_MODE_NONE
    return ExtrapolationMode.EXTRAPOLATION_MODE_SERVER_ONLY


def parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def to_timestamp(value: datetime) -> Timestamp:
    timestamp = Timestamp()
    timestamp.FromDatetime(value)
    return timestamp


def resolve_time_window(
    *,
    start: datetime | None,
    end: datetime | None,
    last_hours: float,
) -> tuple[datetime, datetime]:
    resolved_end = end or datetime.now(UTC)
    resolved_start = start or resolved_end - timedelta(hours=last_hours)
    return resolved_start, resolved_end


def load_spec(path: str) -> dict[str, Any]:
    with open(path) as spec_file:
        return json.load(spec_file)


def get_query_string(spec: dict[str, Any], measure: str) -> str:
    if "query_string" in spec:
        return spec["query_string"]
    query_strings = spec.get("query_string_by_measure", {})
    return query_strings.get(measure, "")


def build_filter(spec: dict[str, Any], measure: str) -> TraceItemFilter | None:
    if "filter" in spec:
        return ParseDict(spec["filter"], TraceItemFilter())

    query_string = get_query_string(spec, measure)
    if not query_string:
        return None
    if query_string in {"is_transaction:true", "is_transaction:1"}:
        return TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=get_attribute_key("is_transaction"),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_bool=True),
            )
        )
    raise ValueError(f"Unsupported query string shortcut: {query_string}")


def build_column(column: str) -> Column:
    if column in {"count()", "count_sample()"}:
        return Column(
            aggregation=AttributeAggregation(
                aggregate=Function.FUNCTION_COUNT,
                key=get_count_key(column),
                label=column,
                extrapolation_mode=get_extrapolation_mode(column),
            )
        )
    return Column(key=get_attribute_key(column), label=column)


def build_columns(spec: dict[str, Any]) -> list[Column]:
    if "columns" in spec:
        return [ParseDict(column, Column()) for column in spec["columns"]]
    return [build_column(column) for column in spec.get("selected_columns", [])]


def build_order_by(spec: dict[str, Any]) -> list[TraceItemTableRequest.OrderBy]:
    orderby = spec.get("orderby", spec.get("order_by"))
    if not orderby:
        return []
    if "order_by" in spec:
        return [
            ParseDict(order_by, TraceItemTableRequest.OrderBy()) for order_by in spec["order_by"]
        ]
    return [
        TraceItemTableRequest.OrderBy(
            column=build_column(column.lstrip("-")),
            descending=column.startswith("-"),
        )
        for column in orderby
    ]


def build_group_by(spec: dict[str, Any]) -> list[AttributeKey]:
    if "group_by" in spec:
        return [ParseDict(group_by, AttributeKey()) for group_by in spec["group_by"]]
    selected_columns = spec.get("selected_columns", [])
    if not any(column in {"count()", "count_sample()"} for column in selected_columns):
        return []
    return [
        get_attribute_key(column)
        for column in selected_columns
        if column not in {"count()", "count_sample()"}
    ]


def build_request(
    *,
    spec: dict[str, Any],
    measure: str,
    organization_id: int,
    project_ids: Sequence[int],
    start: datetime,
    end: datetime,
    cogs_category: str,
    referrer: str,
    limit: int,
    offset: int,
) -> TraceItemTableRequest:
    meta = RequestMeta(
        organization_id=organization_id,
        project_ids=project_ids,
        cogs_category=cogs_category,
        referrer=referrer,
        start_timestamp=to_timestamp(start),
        end_timestamp=to_timestamp(end),
        trace_item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
        downsampled_storage_config=DownsampledStorageConfig(
            mode=DownsampledStorageConfig.MODE_HIGHEST_ACCURACY
        ),
    )
    request_filter = build_filter(spec, measure)
    request = TraceItemTableRequest(
        meta=meta,
        columns=build_columns(spec),
        order_by=build_order_by(spec),
        group_by=build_group_by(spec),
        limit=limit,
    )
    if request_filter is not None:
        request.filter.CopyFrom(request_filter)
    if offset:
        request.page_token.CopyFrom(PageToken(offset=offset))
    return request


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Print a Snuba EAP TraceItemTableRequest body from a small query spec.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("spec", nargs="?", default=str(DEFAULT_SPEC_PATH))
    parser.add_argument("--organization-id", type=int, default=1)
    parser.add_argument("--project-id", dest="project_ids", action="append", type=int)
    parser.add_argument("--measure", choices=["segments", "spans"], default="segments")
    parser.add_argument("--start", type=parse_datetime)
    parser.add_argument("--end", type=parse_datetime)
    parser.add_argument("--last-hours", type=float, default=1.0)
    parser.add_argument("--cogs-category", default="snuba-admin")
    parser.add_argument("--referrer")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--offset", type=int, default=0)
    args = parser.parse_args(argv)
    if args.last_hours <= 0:
        parser.error("--last-hours must be greater than 0")
    start, end = resolve_time_window(start=args.start, end=args.end, last_hours=args.last_hours)
    if start >= end:
        parser.error("--start must be earlier than --end")
    spec = load_spec(args.spec)

    request = build_request(
        spec=spec,
        measure=args.measure,
        organization_id=args.organization_id,
        project_ids=args.project_ids or [1],
        start=start,
        end=end,
        cogs_category=args.cogs_category,
        referrer=args.referrer or spec.get("referrer", DEFAULT_REFERRER),
        limit=args.limit if args.limit is not None else spec.get("limit", 1),
        offset=args.offset,
    )
    print(MessageToJson(request, preserving_proto_field_name=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
