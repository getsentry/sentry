from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from functools import partial
from typing import Protocol, TypeVar

import sentry_sdk
import sentry_sdk.scope
import urllib3
from google.protobuf.json_format import MessageToJson
from google.protobuf.message import Message as ProtobufMessage
from rest_framework.exceptions import NotFound
from sentry_protos.snuba.v1.endpoint_create_subscription_pb2 import (
    CreateSubscriptionRequest,
    CreateSubscriptionResponse,
)
from sentry_protos.snuba.v1.endpoint_delete_trace_items_pb2 import (
    DeleteTraceItemsRequest,
    DeleteTraceItemsResponse,
)
from sentry_protos.snuba.v1.endpoint_get_trace_pb2 import GetTraceRequest, GetTraceResponse
from sentry_protos.snuba.v1.endpoint_get_traces_pb2 import GetTracesRequest, GetTracesResponse
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesRequest, TimeSeriesResponse
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import (
    TraceItemAttributeNamesRequest,
    TraceItemAttributeNamesResponse,
    TraceItemAttributeValuesRequest,
    TraceItemAttributeValuesResponse,
)
from sentry_protos.snuba.v1.endpoint_trace_item_details_pb2 import (
    TraceItemDetailsRequest,
    TraceItemDetailsResponse,
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
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta
from urllib3.response import BaseHTTPResponse

from sentry.utils import json, metrics
from sentry.utils.snuba import SnubaError, _snuba_pool

logger = logging.getLogger(__name__)
RPCResponseType = TypeVar("RPCResponseType", bound=ProtobufMessage)

# Show the snuba query params and the corresponding sql or errors in the server logs
SNUBA_INFO_FILE = os.environ.get("SENTRY_SNUBA_INFO_FILE", "")

SNUBA_INFO = (
    os.environ.get("SENTRY_SNUBA_INFO", "false").lower() in ("true", "1") or SNUBA_INFO_FILE
)


@dataclass(frozen=True)
class MultiRpcResponse:
    table_response: list[TraceItemTableResponse]
    timeseries_response: list[TimeSeriesResponse]


def log_snuba_info(content: str) -> None:
    if SNUBA_INFO_FILE:
        with open(SNUBA_INFO_FILE, "a") as file:
            file.writelines(content)
    else:
        print(content)  # NOQA: only prints when an env variable is set


class SnubaRPCError(SnubaError):
    pass


class SnubaRPCRateLimitExceeded(SnubaRPCError):
    pass


class SnubaRPCRequest(Protocol):
    def SerializeToString(self, deterministic: bool = ...) -> bytes: ...

    @property
    def meta(
        self,
    ) -> RequestMeta: ...


def table_rpc(requests: list[TraceItemTableRequest]) -> list[TraceItemTableResponse]:
    return _make_rpc_requests(table_requests=requests).table_response


def timeseries_rpc(requests: list[TimeSeriesRequest]) -> list[TimeSeriesResponse]:
    return _make_rpc_requests(timeseries_requests=requests).timeseries_response


def get_trace_rpc(request: GetTraceRequest) -> GetTraceResponse:
    resp = _make_rpc_request("EndpointGetTrace", "v1", referrer=request.meta.referrer, req=request)
    response = GetTraceResponse()
    response.ParseFromString(resp.data)
    return response


@sentry_sdk.trace
def _make_rpc_requests(
    table_requests: list[TraceItemTableRequest] | None = None,
    timeseries_requests: list[TimeSeriesRequest] | None = None,
) -> MultiRpcResponse:
    """Given lists of requests batch and run them together"""
    # Throw the two lists together, _make_rpc_requests will just run them all
    table_requests = [] if table_requests is None else table_requests
    timeseries_requests = [] if timeseries_requests is None else timeseries_requests
    requests = table_requests + timeseries_requests

    endpoint_names: list[str] = []
    for request in requests:
        endpoint_name = (
            "EndpointTraceItemTable"
            if isinstance(request, TraceItemTableRequest)
            else "EndpointTimeSeries"
        )
        endpoint_names.append(endpoint_name)
        logger.info(
            f"Running a {endpoint_name} RPC query",  # noqa: LOG011
            extra={
                "rpc_query": json.loads(MessageToJson(request)),
                "referrer": request.meta.referrer,
                "organization_id": request.meta.organization_id,
                "trace_item_type": request.meta.trace_item_type,
            },
        )

    referrers = [req.meta.referrer for req in requests]
    assert (
        len(referrers) == len(requests) == len(endpoint_names)
    ), "Length of Referrers must match length of requests for making requests"

    if referrers:
        sentry_sdk.set_tag("query.referrer", referrers[0])

    # Sets the thread parameters once so we're not doing it in the map repeatedly
    partial_request = partial(
        _make_rpc_request,
        thread_isolation_scope=sentry_sdk.get_isolation_scope(),
        thread_current_scope=sentry_sdk.get_current_scope(),
    )
    with ThreadPoolExecutor(thread_name_prefix=__name__, max_workers=10) as query_thread_pool:
        response = [
            result
            for result in query_thread_pool.map(
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

            if len(table_response.column_values) > 0:
                rpc_rows = len(table_response.column_values[0].results)
            else:
                rpc_rows = 0
            logger.info(
                "Table RPC query response",
                extra={
                    "rpc_rows": rpc_rows,
                    "page_token": table_response.page_token,
                    "meta": table_response.meta,
                },
            )
            metrics.distribution("snuba_rpc.table_response.length", rpc_rows)
        elif isinstance(request, TimeSeriesRequest):
            timeseries_response = TimeSeriesResponse()
            timeseries_response.ParseFromString(item.data)
            timeseries_results.append(timeseries_response)

            if len(timeseries_response.result_timeseries) > 0:
                rpc_rows = len(timeseries_response.result_timeseries[0].data_points)
            else:
                rpc_rows = 0
            logger.info(
                "Timeseries RPC query response",
                extra={
                    "rpc_rows": rpc_rows,
                    "meta": timeseries_response.meta,
                },
            )
            metrics.distribution("snuba_rpc.timeseries_response.length", rpc_rows)
    return MultiRpcResponse(table_results, timeseries_results)


def attribute_names_rpc(req: TraceItemAttributeNamesRequest) -> TraceItemAttributeNamesResponse:
    """
    This endpoint allows you to request attribute names for traces matching some filters.
    You can also specify a substring to refine the names returned.
    """
    resp = _make_rpc_request("EndpointTraceItemAttributeNames", "v1", req.meta.referrer, req)
    response = TraceItemAttributeNamesResponse()
    response.ParseFromString(resp.data)
    return response


def attribute_values_rpc(req: TraceItemAttributeValuesRequest) -> TraceItemAttributeValuesResponse:
    """
    This endpoints allows you to request values for a given attribute key.
    Only works for string attributes.

    You can specify organizationID / projectID / time range / TraceItemType through meta.
    You cannot apply arbitrary attribute filters (e.g. group_id) to this query.
    You can specify a substring to refine the values returned.
    """
    resp = _make_rpc_request("AttributeValuesRequest", "v1", req.meta.referrer, req)
    response = TraceItemAttributeValuesResponse()
    response.ParseFromString(resp.data)
    return response


def get_traces_rpc(req: GetTracesRequest) -> GetTracesResponse:
    """
    Get Traces matching some set of TraceItemFilters.
    The Trace data returned are restricted to the set of TraceAttribute.Key
    """
    resp = _make_rpc_request("EndpointGetTraces", "v1", req.meta.referrer, req)
    response = GetTracesResponse()
    response.ParseFromString(resp.data)
    return response


def trace_item_stats_rpc(req: TraceItemStatsRequest) -> TraceItemStatsResponse:
    resp = _make_rpc_request("EndpointTraceItemStats", "v1", req.meta.referrer, req)
    response = TraceItemStatsResponse()
    response.ParseFromString(resp.data)
    return response


def trace_item_details_rpc(req: TraceItemDetailsRequest) -> TraceItemDetailsResponse:
    """
    An RPC which requests all of the details about a specific trace item.
    For example, you might say "give me all of the attributes for the log with id 1234" or
    "give me all of the attributes for the span with id 12345 and trace_id 34567"
    """
    resp = _make_rpc_request("EndpointTraceItemDetails", "v1", req.meta.referrer, req)
    response = TraceItemDetailsResponse()
    response.ParseFromString(resp.data)
    return response


def delete_trace_items_rpc(req: DeleteTraceItemsRequest) -> DeleteTraceItemsResponse:
    """
    An RPC which deletes trace items matching the filters specified in the request.
    Used for deleting EAP trace items (e.g. occurrences).
    """
    resp = _make_rpc_request("EndpointDeleteTraceItems", "v1", req.meta.referrer, req)
    response = DeleteTraceItemsResponse()
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


@sentry_sdk.trace
def _make_rpc_request(
    endpoint_name: str,
    class_version: str,
    referrer: str | None,
    req: SnubaRPCRequest | CreateSubscriptionRequest,
    thread_isolation_scope: sentry_sdk.Scope | None = None,
    thread_current_scope: sentry_sdk.Scope | None = None,
) -> BaseHTTPResponse:
    thread_isolation_scope = (
        sentry_sdk.get_isolation_scope()
        if thread_isolation_scope is None
        else thread_isolation_scope
    )
    thread_current_scope = (
        sentry_sdk.get_current_scope() if thread_current_scope is None else thread_current_scope
    )
    if SNUBA_INFO:
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
                    if http_resp.status == 404:
                        raise NotFound() from SnubaRPCError(error)
                    if http_resp.status == 429:
                        raise SnubaRPCRateLimitExceeded(error)
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
