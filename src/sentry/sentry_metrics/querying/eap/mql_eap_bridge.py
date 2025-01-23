from collections.abc import Iterable, Sequence
from datetime import datetime, timedelta

import snuba_sdk.mql.mql
from google.protobuf.timestamp_pb2 import Timestamp as ProtobufTimestamp
from sentry_protos.snuba.v1alpha.endpoint_aggregate_bucket_pb2 import (
    AggregateBucketRequest,
    AggregateBucketResponse,
)
from sentry_protos.snuba.v1alpha.request_common_pb2 import RequestMeta
from sentry_protos.snuba.v1alpha.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1alpha.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    OrFilter,
    TraceItemFilter,
)
from snuba_sdk import Timeseries
from snuba_sdk.conditions import And as MQLAnd
from snuba_sdk.conditions import Condition as MQLCondition
from snuba_sdk.conditions import ConditionGroup
from snuba_sdk.conditions import Op as MQLOp
from snuba_sdk.conditions import Or as MQLOr

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils import snuba_rpc


def parse_mql_filters(group: ConditionGroup) -> Iterable[TraceItemFilter]:
    for cond in group:
        if isinstance(cond, MQLAnd):
            yield TraceItemFilter(
                and_filter=AndFilter(filters=list(parse_mql_filters(cond.conditions)))
            )
        elif isinstance(cond, MQLOr):
            yield TraceItemFilter(
                or_filter=OrFilter(filters=list(parse_mql_filters(cond.conditions)))
            )
        elif isinstance(cond, MQLCondition):
            if cond.op == MQLOp.EQ:
                yield TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=AttributeKey(name=cond.lhs.name, type=AttributeKey.Type.TYPE_STRING),
                        value=AttributeValue(val_str=cond.rhs),
                    )
                )
        # TODO: maybe we want to implement other stuff


def make_eap_request(
    query_mql: str,
    start: datetime,
    end: datetime,
    interval: int,
    organization: Organization,
    projects: Sequence[Project],
    referrer: str,
) -> dict:
    start_time_proto = ProtobufTimestamp()
    start_time_proto.FromDatetime(start)
    end_time_proto = ProtobufTimestamp()
    end_time_proto.FromDatetime(end)

    ts: Timeseries = snuba_sdk.mql.mql.parse_mql(query_mql)

    aggregate_map = {
        "sum": AggregateBucketRequest.FUNCTION_SUM,
        "avg": AggregateBucketRequest.FUNCTION_AVERAGE,
        "p50": AggregateBucketRequest.FUNCTION_P50,
        "p95": AggregateBucketRequest.FUNCTION_P95,
        "P99": AggregateBucketRequest.FUNCTION_P99,
        "count": AggregateBucketRequest.FUNCTION_COUNT,
    }

    rpc_filters = None
    if ts.filters is not None and len(ts.filters) > 0:
        rpc_filters = TraceItemFilter(
            and_filter=AndFilter(filters=list(parse_mql_filters(ts.filters)))
        )
    aggregate_req = AggregateBucketRequest(
        meta=RequestMeta(
            organization_id=organization.id,
            cogs_category="events_analytics_platform",
            referrer=referrer,
            project_ids=[project.id for project in projects],
            start_timestamp=start_time_proto,
            end_timestamp=end_time_proto,
        ),
        aggregate=aggregate_map[ts.aggregate],
        filter=rpc_filters,
        granularity_secs=interval,
        key=AttributeKey(
            name=ts.metric.mri.split("/")[1].split("@")[0], type=AttributeKey.TYPE_DOUBLE
        ),
    )
    aggregate_resp = snuba_rpc.rpc(aggregate_req, AggregateBucketResponse)

    series_data = list(aggregate_resp.result)
    duration = end - start
    intervals = []
    if len(series_data) > 0:
        bucket_size_secs = duration.total_seconds() / len(series_data)
        for i in range(len(series_data)):
            intervals.append((start + timedelta(seconds=bucket_size_secs * i)).isoformat())
    intervals.append(end.isoformat())

    return {
        "data": [
            [
                {
                    "by": {},
                    "totals": None,
                    "series": series_data,
                }
            ]
        ],
        "meta": [
            [
                {"name": "aggregate_value", "type": "Float64"},
                {
                    "group_bys": [],
                    "order": "DESC",
                    "limit": 770,
                    "has_more": False,
                    "unit_family": None,
                    "unit": "none",
                    "scaling_factor": 1,
                },
            ]
        ],
        "start": start.isoformat(),
        "end": end.isoformat(),
        "intervals": intervals,
    }
