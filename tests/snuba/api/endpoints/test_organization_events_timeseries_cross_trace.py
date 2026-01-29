import uuid

from sentry_protos.snuba.v1.downsampled_storage_pb2 import DownsampledStorageMeta
from sentry_protos.snuba.v1.endpoint_time_series_pb2 import TimeSeriesResponse
from sentry_protos.snuba.v1.request_common_pb2 import ResponseMeta

from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsTimeseriesCrossTraceEndpointTest(OrganizationEventsEndpointTestBase):
    viewname = "sentry-api-0-organization-events-timeseries"

    def test_cross_trace_query_with_logs(self) -> None:
        trace_id = uuid.uuid4().hex
        excluded_trace_id = uuid.uuid4().hex
        logs = [
            self.create_ourlog(
                {"body": "foo", "trace_id": trace_id},
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {"body": "bar", "trace_id": excluded_trace_id},
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_ourlogs(logs)
        self.store_spans(
            [
                # only this event should show up since we'll filtered to trace_id
                self.create_span(
                    {
                        "description": "baz",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "five"},
                        "trace_id": trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "baz",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "six"},
                        "trace_id": excluded_trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
        )

        response = self.do_request(
            {
                "field": ["tags[foo]", "count()"],
                "query": "description:baz",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spans",
                # Interval and statsPeriod are tested by actual timeseries endpoints, just test we get the right data back
                "interval": "1d",
                "statsPeriod": "1d",
                "topEvents": 5,
                "groupBy": ["tags[foo]"],
                "logQuery": ["message:foo"],
            }
        )

        assert response.status_code == 200, response.content
        # With trace_filters applied correctly, only the span in trace_id (matching logQuery) is included
        assert len(response.data["timeSeries"]) == 1
        timeseries = response.data["timeSeries"][0]
        values = timeseries["values"]
        assert not timeseries["meta"]["isOther"]
        assert len(values) == 2
        assert values[0]["value"] == 0
        assert values[1]["value"] == 1

    def test_cross_trace_query_with_spans(self) -> None:
        trace_id = uuid.uuid4().hex
        excluded_trace_id = uuid.uuid4().hex
        self.store_spans(
            [
                # only this event should show up since we'll filtered to trace_id
                self.create_span(
                    {
                        "description": "baz",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "five"},
                        "trace_id": trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "boo",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "six"},
                        "trace_id": trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "baz",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "seven"},
                        "trace_id": excluded_trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
        )

        response = self.do_request(
            {
                "field": ["tags[foo]", "count()"],
                "query": "description:baz",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "interval": "1d",
                "statsPeriod": "1d",
                "spanQuery": ["tags[foo]:six"],
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["timeSeries"]) == 1
        values = response.data["timeSeries"][0]["values"]
        assert len(values) == 2
        assert values[0]["value"] == 0
        assert values[1]["value"] == 1

    def test_cross_trace_query_with_spans_and_logs(self) -> None:
        trace_id = uuid.uuid4().hex
        excluded_trace_id = uuid.uuid4().hex
        # Both of these traces will be valid
        logs = [
            self.create_ourlog(
                {"body": "foo", "trace_id": trace_id},
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {"body": "foo", "trace_id": excluded_trace_id},
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_ourlogs(logs)
        self.store_spans(
            [
                # only this event should show up since we'll filtered to trace_id
                self.create_span(
                    {
                        "description": "baz",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "five"},
                        "trace_id": trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
                # we should only get this trace
                self.create_span(
                    {
                        "description": "boo",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "six"},
                        "trace_id": trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "baz",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "seven"},
                        "trace_id": excluded_trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
        )

        response = self.do_request(
            {
                "field": ["tags[foo]", "count()"],
                "query": "description:baz",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "interval": "1d",
                "statsPeriod": "1d",
                "spanQuery": ["tags[foo]:six"],
                "logQuery": ["message:foo"],
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["timeSeries"]) == 1
        values = response.data["timeSeries"][0]["values"]
        assert len(values) == 2
        assert values[0]["value"] == 0
        assert values[1]["value"] == 1

    def test_cross_trace_query_with_multiple_spans(self) -> None:
        trace_id = uuid.uuid4().hex
        excluded_trace_id = uuid.uuid4().hex
        self.store_spans(
            [
                # only this event should show up since we'll filtered to trace_id
                self.create_span(
                    {
                        "description": "baz",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "five"},
                        "trace_id": trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
                # we should only get this trace
                self.create_span(
                    {
                        "description": "boo",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "six"},
                        "trace_id": trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "bam",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "seven"},
                        "trace_id": trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "baz",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "eight"},
                        "trace_id": excluded_trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
        )

        response = self.do_request(
            {
                "field": ["tags[foo]", "count()"],
                "query": "description:baz",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "interval": "1d",
                "statsPeriod": "1d",
                "spanQuery": ["tags[foo]:six", "tags[foo]:seven"],
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["timeSeries"]) == 1
        values = response.data["timeSeries"][0]["values"]
        assert len(values) == 2
        assert values[0]["value"] == 0
        assert values[1]["value"] == 1

    def test_cross_trace_query_with_multiple_logs(self) -> None:
        trace_id = uuid.uuid4().hex
        excluded_trace_id = uuid.uuid4().hex
        logs = [
            self.create_ourlog(
                {"body": "foo", "trace_id": trace_id},
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {"body": "faa", "trace_id": trace_id},
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {"body": "bar", "trace_id": excluded_trace_id},
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_ourlogs(logs)
        self.store_spans(
            [
                # only this event should show up since we'll filtered to trace_id
                self.create_span(
                    {
                        "description": "baz",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "five"},
                        "trace_id": trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "baz",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "eight"},
                        "trace_id": excluded_trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
        )

        response = self.do_request(
            {
                "field": ["tags[foo]", "count()"],
                "query": "description:baz",
                "orderby": "count()",
                "project": self.project.id,
                "dataset": "spans",
                "interval": "1d",
                "statsPeriod": "1d",
                "logQuery": ["message:faa", "message:foo"],
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["timeSeries"]) == 1
        values = response.data["timeSeries"][0]["values"]
        assert len(values) == 2
        assert values[0]["value"] == 0
        assert values[1]["value"] == 1

    def test_top_events_with_log_query_includes_trace_filters(self) -> None:
        """Test that topEvents queries with logQuery include trace_filters in RPC payload"""
        from unittest.mock import patch

        trace_id = uuid.uuid4().hex
        excluded_trace_id = uuid.uuid4().hex

        logs = [
            self.create_ourlog(
                {"body": "foo", "trace_id": trace_id},
                timestamp=self.ten_mins_ago,
            ),
            self.create_ourlog(
                {"body": "bar", "trace_id": excluded_trace_id},
                timestamp=self.nine_mins_ago,
            ),
        ]
        self.store_ourlogs(logs)
        self.store_spans(
            [
                self.create_span(
                    {
                        "description": "baz",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "five"},
                        "trace_id": trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
                self.create_span(
                    {
                        "description": "baz",
                        "sentry_tags": {"status": "success"},
                        "tags": {"foo": "six"},
                        "trace_id": excluded_trace_id,
                    },
                    start_ts=self.ten_mins_ago,
                ),
            ],
        )

        # Patch the RPC call to capture the request payload
        with patch(
            "sentry.snuba.rpc_dataset_common.snuba_rpc.timeseries_rpc"
        ) as mock_timeseries_rpc:
            # Return a minimal valid response using proper protobuf types
            mock_timeseries_rpc.return_value = [
                TimeSeriesResponse(
                    result_timeseries=[],
                    meta=ResponseMeta(
                        request_id="test",
                        downsampled_storage_meta=DownsampledStorageMeta(),
                    ),
                )
            ]

            response = self.do_request(
                {
                    "field": ["tags[foo]", "count()"],
                    "query": "description:baz",
                    "orderby": "count()",
                    "project": self.project.id,
                    "dataset": "spans",
                    "interval": "1d",
                    "statsPeriod": "1d",
                    "topEvents": 5,
                    "excludeOther": 1,
                    "groupBy": ["tags[foo]"],
                    "logQuery": ["message:foo"],
                }
            )

            # Verify the response was successful
            assert response.status_code == 200, response.content
            # Verify the RPC was called with trace_filters
            assert mock_timeseries_rpc.called
            # Get the requests argument (first positional argument)
            rpc_requests = mock_timeseries_rpc.call_args[0][0]
            # Should have at least one request
            assert len(rpc_requests) > 0
            # The first request should have trace_filters
            first_request = rpc_requests[0]
            assert hasattr(first_request, "trace_filters")
            # trace_filters should not be empty when logQuery is provided
            assert len(first_request.trace_filters) > 0
