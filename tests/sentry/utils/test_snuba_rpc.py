from typing import Any
from unittest import mock

import pytest
import urllib3
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
from sentry_protos.snuba.v1.endpoint_trace_items_pb2 import (
    ExportTraceItemsRequest,
    ExportTraceItemsResponse,
)
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from urllib3 import HTTPResponse
from urllib3.exceptions import ReadTimeoutError

from sentry.utils import snuba_rpc
from sentry.utils.snuba import _snuba_pool


def _meta() -> RequestMeta:
    return RequestMeta(
        organization_id=123,
        referrer="test.referrer",
        trace_item_type=TraceItemType.TRACE_ITEM_TYPE_LOG,
    )


def _request() -> TraceItemTableRequest:
    return TraceItemTableRequest(meta=_meta())


def test_logs_referrer_and_row_count_when_rows_provided() -> None:
    with (
        mock.patch.object(snuba_rpc.logger, "info") as mock_info,
        mock.patch("sentry.utils.snuba_rpc.metrics.distribution") as mock_distribution,
    ):
        snuba_rpc._log_rpc_response("EndpointTraceItemDetails", _request(), 5)

    extra = mock_info.call_args.kwargs["extra"]

    assert extra["rpc_rows"] == 5
    assert extra["referrer"] == "test.referrer"
    assert extra["organization_id"] == 123
    assert mock_distribution.call_args == mock.call(
        "snuba_rpc.response.length", 5, tags={"endpoint": "EndpointTraceItemDetails"}
    )


def test_skips_metric_when_row_count_is_none() -> None:
    with (
        mock.patch.object(snuba_rpc.logger, "info") as mock_info,
        mock.patch("sentry.utils.snuba_rpc.metrics.distribution") as mock_distribution,
    ):
        snuba_rpc._log_rpc_response("EndpointGetTrace", _request(), None)

    extra = mock_info.call_args.kwargs["extra"]

    assert extra["rpc_rows"] is None
    assert mock_distribution.call_count == 0


def test_includes_debug_message_when_debug_is_a_string() -> None:
    with (
        mock.patch.object(snuba_rpc.logger, "info") as mock_info,
        mock.patch("sentry.utils.snuba_rpc.metrics.distribution"),
    ):
        snuba_rpc._log_rpc_response("EndpointGetTrace", _request(), 0, debug="why")

    extra = mock_info.call_args.kwargs["extra"]

    assert extra["debug"] is True
    assert extra["debug_msg"] == "why"


def _get_trace_response() -> GetTraceResponse:
    response = GetTraceResponse()
    first_group = response.item_groups.add()
    first_group.items.add()
    first_group.items.add()
    second_group = response.item_groups.add()
    second_group.items.add()
    return response


def _attribute_names_response() -> TraceItemAttributeNamesResponse:
    response = TraceItemAttributeNamesResponse()
    response.attributes.add()
    response.attributes.add()
    return response


def _attribute_values_response() -> TraceItemAttributeValuesResponse:
    response = TraceItemAttributeValuesResponse()
    response.values.extend(["a", "b", "c"])
    return response


def _get_traces_response() -> GetTracesResponse:
    response = GetTracesResponse()
    response.traces.add()
    response.traces.add()
    return response


def _trace_item_stats_response() -> TraceItemStatsResponse:
    response = TraceItemStatsResponse()
    response.results.add()
    return response


def _trace_item_details_response() -> TraceItemDetailsResponse:
    response = TraceItemDetailsResponse()
    for _ in range(4):
        response.attributes.add()
    return response


def _delete_trace_items_response() -> DeleteTraceItemsResponse:
    return DeleteTraceItemsResponse(matching_items_count=7)


def _export_logs_response() -> ExportTraceItemsResponse:
    response = ExportTraceItemsResponse()
    response.trace_items.add()
    response.trace_items.add()
    return response


@pytest.mark.parametrize(
    "helper, request_obj, response_obj, expected_endpoint, expected_rows",
    [
        (
            snuba_rpc.get_trace_rpc,
            GetTraceRequest(meta=_meta()),
            _get_trace_response(),
            "EndpointGetTrace",
            3,
        ),
        (
            snuba_rpc.attribute_names_rpc,
            TraceItemAttributeNamesRequest(meta=_meta()),
            _attribute_names_response(),
            "EndpointTraceItemAttributeNames",
            2,
        ),
        (
            snuba_rpc.attribute_values_rpc,
            TraceItemAttributeValuesRequest(meta=_meta()),
            _attribute_values_response(),
            "AttributeValuesRequest",
            3,
        ),
        (
            snuba_rpc.get_traces_rpc,
            GetTracesRequest(meta=_meta()),
            _get_traces_response(),
            "EndpointGetTraces",
            2,
        ),
        (
            snuba_rpc.trace_item_stats_rpc,
            TraceItemStatsRequest(meta=_meta()),
            _trace_item_stats_response(),
            "EndpointTraceItemStats",
            1,
        ),
        (
            snuba_rpc.trace_item_details_rpc,
            TraceItemDetailsRequest(meta=_meta()),
            _trace_item_details_response(),
            "EndpointTraceItemDetails",
            4,
        ),
        (
            snuba_rpc.delete_trace_items_rpc,
            DeleteTraceItemsRequest(meta=_meta()),
            _delete_trace_items_response(),
            "EndpointDeleteTraceItems",
            7,
        ),
        (
            snuba_rpc.export_logs_rpc,
            ExportTraceItemsRequest(meta=_meta()),
            _export_logs_response(),
            "EndpointExportTraceItems",
            2,
        ),
    ],
)
def test_single_request_helper_logs_response_row_count(
    helper: Any,
    request_obj: Any,
    response_obj: Any,
    expected_endpoint: str,
    expected_rows: int,
) -> None:
    http_response = mock.Mock()
    http_response.data = response_obj.SerializeToString()

    with (
        mock.patch.object(snuba_rpc, "_make_rpc_request", return_value=http_response),
        mock.patch.object(snuba_rpc.logger, "info") as mock_info,
        mock.patch("sentry.utils.snuba_rpc.metrics.distribution") as mock_distribution,
    ):
        helper(request_obj)

    extra = mock_info.call_args.kwargs["extra"]

    assert mock_info.call_args.args[1] == expected_endpoint
    assert extra["rpc_rows"] == expected_rows
    assert mock_distribution.call_args == mock.call(
        "snuba_rpc.response.length", expected_rows, tags={"endpoint": expected_endpoint}
    )


def _table_response() -> TraceItemTableResponse:
    response = TraceItemTableResponse()
    column = response.column_values.add()
    column.results.add()
    column.results.add()
    return response


def _timeseries_response() -> TimeSeriesResponse:
    response = TimeSeriesResponse()
    response.result_timeseries.add().data_points.add()
    return response


def test_table_rpc_logs_trace_item_type_and_row_count() -> None:
    http_response = mock.Mock()
    http_response.data = _table_response().SerializeToString()

    with (
        mock.patch.object(snuba_rpc, "_make_rpc_request", return_value=http_response),
        mock.patch.object(snuba_rpc.logger, "info") as mock_info,
        mock.patch("sentry.utils.snuba_rpc.metrics.distribution") as mock_distribution,
    ):
        snuba_rpc.table_rpc([TraceItemTableRequest(meta=_meta())])

    extra = mock_info.call_args.kwargs["extra"]

    assert mock_info.call_args.args[0] == "Table RPC query response"
    assert extra["rpc_rows"] == 2
    assert extra["trace_item_type"] == TraceItemType.TRACE_ITEM_TYPE_LOG
    assert mock_distribution.call_args == mock.call("snuba_rpc.table_response.length", 2)


def test_timeseries_rpc_logs_trace_item_type_and_row_count() -> None:
    http_response = mock.Mock()
    http_response.data = _timeseries_response().SerializeToString()

    with (
        mock.patch.object(snuba_rpc, "_make_rpc_request", return_value=http_response),
        mock.patch.object(snuba_rpc.logger, "info") as mock_info,
        mock.patch("sentry.utils.snuba_rpc.metrics.distribution") as mock_distribution,
    ):
        snuba_rpc.timeseries_rpc([TimeSeriesRequest(meta=_meta())])

    extra = mock_info.call_args.kwargs["extra"]

    assert mock_info.call_args.args[0] == "Timeseries RPC query response"
    assert extra["rpc_rows"] == 1
    assert extra["trace_item_type"] == TraceItemType.TRACE_ITEM_TYPE_LOG
    assert mock_distribution.call_args == mock.call("snuba_rpc.timeseries_response.length", 1)


def _http_response(
    status: int,
    body: bytes = b"",
    retries: urllib3.Retry | None = None,
) -> HTTPResponse:
    return HTTPResponse(status=status, body=body, retries=retries)


def test_table_rpc_retries_transient_upstream_status_once() -> None:
    retry = snuba_rpc._retry_policy("EndpointTraceItemTable")

    assert retry.status == 1
    assert retry.status_forcelist == snuba_rpc._TRANSIENT_UPSTREAM_STATUS_CODES
    assert retry.allowed_methods == frozenset({"POST"})
    assert retry.raise_on_status is False
    assert retry.backoff_factor == 0.25
    assert retry.backoff_max == 1.0
    assert retry.backoff_jitter == 0.1


@pytest.mark.parametrize(
    "endpoint_name",
    [
        "EndpointDeleteTraceItems",
        "EndpointCreateSubscription",
        "EndpointTimeSeries",
        "UnknownEndpoint",
    ],
)
def test_mutating_and_unknown_rpcs_do_not_retry_statuses(endpoint_name: str) -> None:
    retry = snuba_rpc._retry_policy(endpoint_name)

    assert retry is _snuba_pool.retries
    assert retry.status_forcelist == set()


def test_make_rpc_request_passes_retry_policy_for_read_only_rpc() -> None:
    response = _http_response(200)

    with mock.patch.object(_snuba_pool, "urlopen", return_value=response) as urlopen:
        snuba_rpc._make_rpc_request("EndpointTraceItemTable", "v1", _meta().referrer, _request())

    retry = urlopen.call_args.kwargs["retries"]
    assert retry.status == 1
    assert retry.status_forcelist == snuba_rpc._TRANSIENT_UPSTREAM_STATUS_CODES


def test_make_rpc_request_disables_status_retries_for_mutating_rpc() -> None:
    response = _http_response(200)
    request = DeleteTraceItemsRequest(meta=_meta())

    with mock.patch.object(_snuba_pool, "urlopen", return_value=response) as urlopen:
        snuba_rpc._make_rpc_request(
            "EndpointDeleteTraceItems", "v1", request.meta.referrer, request
        )

    retry = urlopen.call_args.kwargs["retries"]
    assert retry is _snuba_pool.retries
    assert retry.status_forcelist == set()


def test_retry_observability_ignores_response_without_retry_history() -> None:
    response = mock.Mock(status=429)

    with mock.patch("sentry.utils.snuba_rpc.metrics.incr") as incr:
        snuba_rpc._record_status_retry_result("EndpointTraceItemTable", response)

    incr.assert_not_called()


def test_make_rpc_request_does_not_retry_read_timeout() -> None:
    timeout = ReadTimeoutError(_snuba_pool, "/rpc/EndpointTraceItemTable/v1", "timeout")

    with (
        mock.patch.object(_snuba_pool, "urlopen", side_effect=timeout),
        mock.patch("sentry.utils.snuba_rpc.metrics.incr") as incr,
        pytest.raises(snuba_rpc.SnubaRPCTimeout),
    ):
        snuba_rpc._make_rpc_request("EndpointTraceItemTable", "v1", _meta().referrer, _request())

    incr.assert_called_once_with("snuba_rpc.read_timeout_error", tags={"referrer": "test.referrer"})


def test_records_recovered_status_retry() -> None:
    retry = urllib3.Retry(total=2, status=2, status_forcelist={503}, allowed_methods={"POST"})
    retry = retry.increment(
        method="POST",
        url="/rpc/EndpointTraceItemTable/v1",
        response=_http_response(503),
    )
    response = _http_response(200, retries=retry)

    with mock.patch("sentry.utils.snuba_rpc.metrics.incr") as incr:
        snuba_rpc._record_status_retry_result("EndpointTraceItemTable", response)

    incr.assert_called_once_with(
        "snuba_rpc.status_retry.result",
        tags={
            "endpoint": "EndpointTraceItemTable",
            "initial_status": 503,
            "outcome": "recovered",
        },
    )


def test_records_exhausted_status_retries() -> None:
    retry = urllib3.Retry(total=2, status=2, status_forcelist={503}, allowed_methods={"POST"})
    for _ in range(2):
        retry = retry.increment(
            method="POST",
            url="/rpc/EndpointTraceItemTable/v1",
            response=_http_response(503),
        )
    response = _http_response(503, body=b"no healthy upstream", retries=retry)

    with mock.patch("sentry.utils.snuba_rpc.metrics.incr") as incr:
        snuba_rpc._record_status_retry_result("EndpointTraceItemTable", response)

    incr.assert_called_once_with(
        "snuba_rpc.status_retry.result",
        tags={
            "endpoint": "EndpointTraceItemTable",
            "initial_status": 503,
            "outcome": "exhausted",
        },
    )


def test_plain_text_upstream_error_is_preserved() -> None:
    response = _http_response(503, body=b"no healthy upstream")

    with pytest.raises(
        snuba_rpc.SnubaRPCError,
        match="Snuba RPC returned HTTP 503: no healthy upstream",
    ):
        snuba_rpc._parse_error(response)


def test_non_transient_status_is_not_retried() -> None:
    retry = snuba_rpc._retry_policy("EndpointTraceItemTable")

    assert retry.is_retry("POST", 429) is False
    assert retry.is_retry("POST", 504) is False


def test_create_subscription_logs_response() -> None:
    http_response = mock.Mock()
    http_response.data = CreateSubscriptionResponse(subscription_id="sub-1").SerializeToString()
    request = CreateSubscriptionRequest(time_series_request=TimeSeriesRequest(meta=_meta()))

    with (
        mock.patch.object(snuba_rpc, "_make_rpc_request", return_value=http_response),
        mock.patch.object(snuba_rpc.logger, "info") as mock_info,
        mock.patch("sentry.utils.snuba_rpc.metrics.distribution") as mock_distribution,
    ):
        snuba_rpc.create_subscription(request)

    extra = mock_info.call_args.kwargs["extra"]

    assert mock_info.call_args.args[1] == "CreateSubscriptionRequest"
    assert extra["rpc_rows"] is None
    assert extra["referrer"] == "test.referrer"
    assert mock_distribution.call_count == 0
