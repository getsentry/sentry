import uuid

import pytest

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
            is_eap=True,
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
        assert len(response.data["timeSeries"]) == 2
        timeseries = response.data["timeSeries"][0]
        values = timeseries["values"]
        assert not timeseries["meta"]["isOther"]
        assert len(values) == 2
        assert values[0]["value"] == 0
        assert values[1]["value"] == 1

        other_timeseries = response.data["timeSeries"][1]
        assert other_timeseries["meta"]["isOther"]

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
            is_eap=True,
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
            is_eap=True,
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

    @pytest.mark.skip(reason="flaky: #106093")
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
            is_eap=True,
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

    def test_cross_trace_qurey_with_multiple_logs(self) -> None:
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
            is_eap=True,
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
