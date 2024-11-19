from __future__ import annotations

import os
from typing import Protocol, TypeVar

import sentry_protos.snuba.v1alpha.request_common_pb2
import sentry_sdk
import sentry_sdk.scope
from google.protobuf.message import Message as ProtobufMessage
from sentry_protos.snuba.v1.endpoint_create_subscription_pb2 import (
    CreateSubscriptionRequest,
    CreateSubscriptionResponse,
)
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesRequest, TimeSeriesResponse
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    TraceItemTableRequest,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.error_pb2 import Error as ErrorProto
from urllib3.response import BaseHTTPResponse

from sentry.utils.snuba import SnubaError, _snuba_pool

RPCResponseType = TypeVar("RPCResponseType", bound=ProtobufMessage)

# Show the snuba query params and the corresponding sql or errors in the server logs
SNUBA_INFO_FILE = os.environ.get("SENTRY_SNUBA_INFO_FILE", "")

SNUBA_INFO = (
    os.environ.get("SENTRY_SNUBA_INFO", "false").lower() in ("true", "1") or SNUBA_INFO_FILE
)


def log_snuba_info(content):
    if SNUBA_INFO_FILE:
        with open(SNUBA_INFO_FILE, "a") as file:
            file.writelines(content)
    else:
        print(content)  # NOQA: only prints when an env variable is set


class SnubaRPCError(SnubaError):
    pass


class SnubaRPCRequest(Protocol):
    def SerializeToString(self, deterministic: bool = ...) -> bytes: ...

    @property
    def meta(
        self,
    ) -> (
        sentry_protos.snuba.v1alpha.request_common_pb2.RequestMeta
        | sentry_protos.snuba.v1.request_common_pb2.RequestMeta
    ): ...


def table_rpc(req: TraceItemTableRequest) -> TraceItemTableResponse:
    resp = _make_rpc_request("EndpointTraceItemTable", "v1", req.meta.referrer, req)
    response = TraceItemTableResponse()
    response.ParseFromString(resp.data)
    return response


def timeseries_rpc(req: TimeSeriesRequest) -> TimeSeriesResponse:
    resp = _make_rpc_request("EndpointTimeSeries", "v1", req.meta.referrer, req)
    response = TimeSeriesResponse()
    response.ParseFromString(resp.data)
    return response


def rpc(
    req: SnubaRPCRequest,
    resp_type: type[RPCResponseType],
) -> RPCResponseType:
    """
    You want to call a snuba RPC. Here's how you do it:

    start_time_proto = ProtobufTimestamp()
    start_time_proto.FromDatetime(start)
    end_time_proto = ProtobufTimestamp()
    end_time_proto.FromDatetime(end)
    aggregate_req = AggregateBucketRequest(
        meta=RequestMeta(
            organization_id=organization.id,
            cogs_category="events_analytics_platform",
            referrer=referrer,
            project_ids=[project.id for project in projects],
            start_timestamp=start_time_proto,
            end_timestamp=end_time_proto,
        ),
        aggregate=AggregateBucketRequest.FUNCTION_SUM,
        filter=TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="op", type=AttributeKey.Type.TYPE_STRING),
                value=AttributeValue(val_str="ai.run"),
            )
        ),
        granularity_secs=60,
        key=AttributeKey(
            name="duration", type=AttributeKey.TYPE_FLOAT
        ),
        attribute_key_transform_context=AttributeKeyTransformContext(),
    )
    aggregate_resp = snuba.rpc(aggregate_req, AggregateBucketResponse)
    """
    cls = req.__class__
    endpoint_name = cls.__name__
    class_version = cls.__module__.split(".", 3)[2]
    http_resp = _make_rpc_request(endpoint_name, class_version, req.meta.referrer, req)
    resp = resp_type()
    resp.ParseFromString(http_resp.data)
    return resp


def _make_rpc_request(
    endpoint_name: str,
    class_version: str,
    referrer: str | None,
    req: SnubaRPCRequest | CreateSubscriptionRequest,
) -> BaseHTTPResponse:
    if SNUBA_INFO:
        from google.protobuf.json_format import MessageToJson

        log_snuba_info(f"{referrer}.body:\n{MessageToJson(req)}")  # type: ignore[arg-type]
    with sentry_sdk.start_span(op="snuba_rpc.run", name=req.__class__.__name__) as span:
        if referrer:
            span.set_tag("snuba.referrer", referrer)
        http_resp = _snuba_pool.urlopen(
            "POST",
            f"/rpc/{endpoint_name}/{class_version}",
            body=req.SerializeToString(),
            headers=(
                {
                    "referer": referrer,
                }
                if referrer
                else {}
            ),
        )
        if http_resp.status != 200 and http_resp.status != 202:
            error = ErrorProto()
            error.ParseFromString(http_resp.data)
            if SNUBA_INFO:
                log_snuba_info(f"{referrer}.error:\n{error}")
            raise SnubaRPCError(error)
        return http_resp


def create_subscription(req: CreateSubscriptionRequest) -> CreateSubscriptionResponse:
    cls = req.__class__
    endpoint_name = cls.__name__
    class_version = cls.__module__.split(".", 3)[2]
    http_resp = _make_rpc_request(endpoint_name, class_version, None, req)
    resp = CreateSubscriptionResponse()
    resp.ParseFromString(http_resp.data)
    return resp
