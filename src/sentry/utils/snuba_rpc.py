from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from functools import partial
from typing import Protocol, TypeVar

import sentry_protos.snuba.v1alpha.request_common_pb2
import sentry_sdk
import sentry_sdk.scope
import urllib3
from google.protobuf.message import Message as ProtobufMessage
from sentry_protos.snuba.v1.endpoint_create_subscription_pb2 import (
    CreateSubscriptionRequest,
    CreateSubscriptionResponse,
)
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesRequest, TimeSeriesResponse
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesRequest,
    TraceItemAttributeNamesResponse,
    TraceItemAttributeValuesRequest,
    TraceItemAttributeValuesResponse,
)
from sentry_protos.snuba.v1.endpoint_trace_item_stats_pb2 import (
    TraceItemStatsRequest,
    TraceItemStatsResponse,
)
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
_query_thread_pool = ThreadPoolExecutor(max_workers=10)


@dataclass(frozen=True)
class MultiRpcResponse:
    table_response: list[TraceItemTableResponse]
    timeseries_response: list[TimeSeriesResponse]


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


def table_rpc(requests: list[TraceItemTableRequest]) -> list[TraceItemTableResponse]:
    return _make_rpc_requests(table_requests=requests).table_response


def timeseries_rpc(requests: list[TimeSeriesRequest]) -> list[TimeSeriesResponse]:
    return _make_rpc_requests(timeseries_requests=requests).timeseries_response


def _make_rpc_requests(
    table_requests: list[TraceItemTableRequest] | None = None,
    timeseries_requests: list[TimeSeriesRequest] | None = None,
) -> MultiRpcResponse:
    """Given lists of requests batch and run them together"""
    # Throw the two lists together, _make_rpc_requests will just run them all
    table_requests = [] if table_requests is None else table_requests
    timeseries_requests = [] if timeseries_requests is None else timeseries_requests
    requests = table_requests + timeseries_requests

    endpoint_names = [
        "EndpointTraceItemTable" if isinstance(req, TraceItemTableRequest) else "EndpointTimeSeries"
        for req in requests
    ]

    referrers = [req.meta.referrer for req in requests]
    assert (
        len(referrers) == len(requests) == len(endpoint_names)
    ), "Length of Referrers must match length of requests for making requests"

    # Sets the thread parameters once so we're not doing it in the map repeatedly
    partial_request = partial(
        _make_rpc_request,
        thread_isolation_scope=sentry_sdk.Scope.get_isolation_scope(),
        thread_current_scope=sentry_sdk.Scope.get_current_scope(),
    )
    response = [
        result
        for result in _query_thread_pool.map(
            partial_request,
            endpoint_names,
            # Currently assuming everything is v1
            ["v1"] * len(referrers),
            referrers,
            requests,
        )
    ]

    # Split the results back up, the thread pool will return them back in order so we can use the type in the
    # requests list to determine which request goes where
    timeseries_results = []
    table_results = []
    for request, item in zip(requests, response):
        if isinstance(request, TraceItemTableRequest):
            table_response = TraceItemTableResponse()
            table_response.ParseFromString(item.data)
            table_results.append(table_response)
        elif isinstance(request, TimeSeriesRequest):
            timeseries_response = TimeSeriesResponse()
            timeseries_response.ParseFromString(item.data)
            timeseries_results.append(timeseries_response)
    return MultiRpcResponse(table_results, timeseries_results)


def attribute_names_rpc(req: TraceItemAttributeNamesRequest) -> TraceItemAttributeNamesResponse:
    resp = _make_rpc_request("EndpointTraceItemAttributeNames", "v1", req.meta.referrer, req)
    response = TraceItemAttributeNamesResponse()
    response.ParseFromString(resp.data)
    return response


def attribute_values_rpc(req: TraceItemAttributeValuesRequest) -> TraceItemAttributeValuesResponse:
    resp = _make_rpc_request("AttributeValuesRequest", "v1", req.meta.referrer, req)
    response = TraceItemAttributeValuesResponse()
    response.ParseFromString(resp.data)
    return response


def trace_item_stats_rpc(req: TraceItemStatsRequest) -> TraceItemStatsResponse:
    resp = _make_rpc_request("EndpointTraceItemStats", "v1", req.meta.referrer, req)
    response = TraceItemStatsResponse()
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
            trace_item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
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
    thread_isolation_scope: sentry_sdk.Scope | None = None,
    thread_current_scope: sentry_sdk.Scope | None = None,
) -> BaseHTTPResponse:
    thread_isolation_scope = (
        sentry_sdk.Scope.get_isolation_scope()
        if thread_isolation_scope is None
        else thread_isolation_scope
    )
    thread_current_scope = (
        sentry_sdk.Scope.get_current_scope()
        if thread_current_scope is None
        else thread_current_scope
    )
    if SNUBA_INFO:
        from google.protobuf.json_format import MessageToJson

        log_snuba_info(f"{referrer}.body:\n{MessageToJson(req)}")  # type: ignore[arg-type]
    with sentry_sdk.scope.use_isolation_scope(thread_isolation_scope):
        with sentry_sdk.scope.use_scope(thread_current_scope):
            with sentry_sdk.start_span(op="snuba_rpc.run", name=req.__class__.__name__) as span:
                if referrer:
                    span.set_tag("snuba.referrer", referrer)
                    span.set_data("snuba.query", req)
                try:
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
                except urllib3.exceptions.HTTPError as err:
                    raise SnubaRPCError(err)
                span.set_tag("timeout", "False")
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
