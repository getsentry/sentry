import uuid

from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsSpansEndpointTest(OrganizationEventsEndpointTestBase):
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
                "logQueries": ["message:foo"],
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["tags[foo]"] == "five"

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
                "spanQueries": ["tags[foo]:six"],
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["tags[foo]"] == "five"

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
                "spanQueries": ["tags[foo]:six"],
                "logQueries": ["message:foo"],
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["tags[foo]"] == "five"

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
                "spanQueries": ["tags[foo]:six", "tags[foo]:seven"],
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["tags[foo]"] == "five"

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
                "logQueries": ["message:faa", "message:foo"],
            }
        )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["tags[foo]"] == "five"
