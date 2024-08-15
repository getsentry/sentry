from collections.abc import Iterable, Sequence
from datetime import datetime, timedelta

import requests
import snuba_sdk.mql.mql
from django.conf import settings
from google.protobuf.timestamp_pb2 import Timestamp as ProtobufTimestamp
from sentry_protos.snuba.v1alpha.endpoint_aggregate_bucket_pb2 import (
    AggregateBucketRequest,
    AggregateBucketResponse,
)
from sentry_protos.snuba.v1alpha.request_common_pb2 import RequestMeta
from sentry_protos.snuba.v1alpha.trace_item_filter_pb2 import (
    AndFilter,
    OrFilter,
    StringFilter,
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
                yield TraceItemFilter(string_filter=StringFilter(key=cond.lhs.name, value=cond.rhs))
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
        "avg": AggregateBucketRequest.FUNCTION_AVG,
        "p50": AggregateBucketRequest.FUNCTION_P50,
        "p95": AggregateBucketRequest.FUNCTION_P95,
        "P99": AggregateBucketRequest.FUNCTION_P99,
        "count": AggregateBucketRequest.FUNCTION_COUNT,
    }

    rpc_filters = None
    if ts.filters is not None:
        rpc_filters = TraceItemFilter(
            and_filter=AndFilter(filters=list(parse_mql_filters(ts.filters)))
        )
    req = AggregateBucketRequest(
        meta=RequestMeta(
            organization_id=organization.id,
            cogs_category="eap",
            referrer=referrer,
            project_ids=[project.id for project in projects],
        ),
        start_timestamp=start_time_proto,
        end_timestamp=end_time_proto,
        aggregate=aggregate_map[ts.aggregate],
        filter=rpc_filters,
    )
    http_resp = requests.post(f"{settings.SENTRY_SNUBA}/timeseries", data=req.SerializeToString())
    http_resp.raise_for_status()

    resp = AggregateBucketResponse()
    resp.ParseFromString(http_resp.content)

    series_data = list(resp.result)
    duration = end - start
    bucket_size_secs = duration.total_seconds() / len(series_data)
    intervals = []
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
