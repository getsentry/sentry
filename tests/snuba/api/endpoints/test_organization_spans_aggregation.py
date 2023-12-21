import hashlib
from datetime import timedelta
from unittest import mock
from uuid import uuid4

from django.urls import reverse
from snuba_sdk import Column, Condition, Function, Op

from sentry.api.endpoints.organization_spans_aggregation import NULL_GROUP
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data

MOCK_SNUBA_RESPONSE = {
    "data": [
        {
            "transaction_id": "80fe542aea4945ffbe612646987ee449",
            "count": 71,
            "spans": [
                [
                    "root_1",
                    1,
                    "parent_1",
                    "e238e6c2e2466b07",
                    "api/0/foo",
                    "other",
                    "2023-09-13 17:12:19",
                    100,
                    1000,
                    1000,
                ],
                [
                    "B1",
                    0,
                    "root_1",
                    "B",
                    "connect",
                    "db",
                    "2023-09-13 17:12:19",
                    150,
                    50,
                    50.0,
                ],
                [
                    "C1",
                    0,
                    "root_1",
                    "C",
                    "resolve_conditions",
                    "discover.endpoint",
                    "2023-09-13 17:12:19",
                    155,
                    0,
                    10.0,
                ],
                [
                    "D1",
                    0,
                    "C1",
                    "D",
                    "resolve_orderby",
                    "discover.snql",
                    "2023-09-13 17:12:19",
                    157,
                    0,
                    20.0,
                ],
                [
                    "E1",
                    0,
                    "C1",
                    NULL_GROUP,
                    "resolve_columns",
                    "discover.snql",
                    "2023-09-13 17:12:19",
                    157,
                    0,
                    20.0,
                ],
            ],
        },
        {
            "transaction_id": "86b21833d1854d9b811000b91e7fccfa",
            "count": 71,
            "spans": [
                [
                    "root_2",
                    1,
                    "parent_2",
                    "e238e6c2e2466b07",
                    "bind_organization_context",
                    "other",
                    "2023-09-13 17:12:39",
                    100,
                    700,
                    0.0,
                ],
                [
                    "B2",
                    0,
                    "root_2",
                    "B",
                    "connect",
                    "db",
                    "2023-09-13 17:12:39",
                    110,
                    10,
                    30.0,
                ],
                [
                    "C2",
                    0,
                    "root_2",
                    "C",
                    "resolve_conditions",
                    "discover.endpoint",
                    "2023-09-13 17:12:39",
                    115,
                    0,
                    40.0,
                ],
                [
                    "D2",
                    0,
                    "C2",
                    "D",
                    "resolve_orderby",
                    "discover.snql",
                    "2023-09-13 17:12:39",
                    150,
                    0,
                    10.0,
                ],
                [
                    "D2-duplicate",
                    0,
                    "C2",
                    "D",
                    "resolve_orderby",
                    "discover.snql",
                    "2023-09-13 17:12:40",
                    155,
                    0,
                    20.0,
                ],
                [
                    "E2",
                    0,
                    "C2",
                    NULL_GROUP,
                    "resolve_columns",
                    "discover.snql",
                    "2023-09-13 17:12:39",
                    157,
                    0,
                    20.0,
                ],
            ],
        },
    ]
}


class OrganizationSpansAggregationTest(APITestCase, SnubaTestCase):
    url_name = "sentry-api-0-organization-spans-aggregation"
    FEATURES = [
        "organizations:starfish-aggregate-span-waterfall",
        "organizations:performance-view",
    ]

    def get_start_end(self, duration):
        return self.day_ago, self.day_ago + timedelta(milliseconds=duration)

    def create_event(
        self,
        trace,
        transaction,
        spans,
        parent_span_id,
        project_id,
        tags=None,
        duration=4000,
        span_id=None,
        measurements=None,
        trace_context=None,
        environment=None,
        **kwargs,
    ):
        start, end = self.get_start_end(duration)
        data = load_data(
            "transaction",
            trace=trace,
            spans=spans,
            timestamp=end,
            start_timestamp=start,
            trace_context=trace_context,
        )
        data["transaction"] = transaction
        data["contexts"]["trace"]["parent_span_id"] = parent_span_id
        if span_id:
            data["contexts"]["trace"]["span_id"] = span_id
        if measurements:
            for key, value in measurements.items():
                data["measurements"][key]["value"] = value
        if tags is not None:
            data["tags"] = tags
        if environment is not None:
            data["environment"] = environment

        with self.feature(self.FEATURES):
            return self.store_event(data, project_id=project_id, **kwargs)

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.day_ago = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.span_ids_event_1 = dict(
            zip(["A", "B", "C", "D", "E"], [uuid4().hex[:16] for _ in range(5)])
        )
        self.trace_id_1 = uuid4().hex

        self.root_event_1 = self.create_event(
            trace=self.trace_id_1,
            trace_context={
                "trace_id": self.trace_id_1,
                "span_id": self.span_ids_event_1["A"],
                "exclusive_time": 100,
            },
            transaction="api/0/foo",
            spans=[
                {
                    "same_process_as_parent": True,
                    "op": "db",
                    "description": "connect",
                    "span_id": self.span_ids_event_1["B"],
                    "trace_id": self.trace_id_1,
                    "parent_span_id": self.span_ids_event_1["A"],
                    "exclusive_time": 50.0,
                    "data": {
                        "duration": 0.050,
                        "offset": 0.050,
                        "span.group": "B",
                        "span.description": "connect",
                    },
                    "sentry_tags": {
                        "description": "connect",
                    },
                },
                {
                    "same_process_as_parent": True,
                    "op": "discover.endpoint",
                    "description": "resolve_conditions",
                    "span_id": self.span_ids_event_1["C"],
                    "trace_id": self.trace_id_1,
                    "parent_span_id": self.span_ids_event_1["A"],
                    "exclusive_time": 10,
                    "data": {
                        "duration": 0.00,
                        "offset": 0.055,
                        "span.group": "C",
                        "span.description": "connect",
                    },
                    "sentry_tags": {
                        "description": "connect",
                    },
                },
                {
                    "same_process_as_parent": True,
                    "op": "discover.snql",
                    "description": "resolve_orderby",
                    "span_id": self.span_ids_event_1["D"],
                    "trace_id": self.trace_id_1,
                    "parent_span_id": self.span_ids_event_1["C"],
                    "exclusive_time": 20,
                    "data": {
                        "duration": 0.00,
                        "offset": 0.057,
                        "span.group": "D",
                        "span.description": "resolve_orderby",
                    },
                    "sentry_tags": {
                        "description": "resolve_orderby",
                    },
                },
                {
                    "same_process_as_parent": True,
                    "op": "discover.snql",
                    "description": "resolve_columns",
                    "span_id": self.span_ids_event_1["E"],
                    "trace_id": self.trace_id_1,
                    "parent_span_id": self.span_ids_event_1["C"],
                    "exclusive_time": 20,
                    "data": {
                        "duration": 0.00,
                        "offset": 0.057,
                        "span.description": "resolve_columns",
                    },
                },
            ],
            parent_span_id=None,
            project_id=self.project.id,
            duration=1000,
            environment="production",
        )

        self.span_ids_event_2 = dict(
            zip(["A", "B", "C", "D", "D2", "E"], [uuid4().hex[:16] for _ in range(6)])
        )
        self.trace_id_2 = uuid4().hex

        self.root_event_2 = self.create_event(
            trace=self.trace_id_2,
            trace_context={
                "trace_id": self.trace_id_2,
                "span_id": self.span_ids_event_2["A"],
                "exclusive_time": 100,
            },
            transaction="api/0/foo",
            spans=[
                {
                    "same_process_as_parent": True,
                    "op": "db",
                    "description": "connect",
                    "span_id": self.span_ids_event_2["B"],
                    "trace_id": self.trace_id_2,
                    "parent_span_id": self.span_ids_event_2["A"],
                    "exclusive_time": 50.0,
                    "data": {
                        "duration": 0.010,
                        "offset": 0.010,
                        "span.group": "B",
                        "span.description": "connect",
                    },
                    "sentry_tags": {
                        "description": "connect",
                    },
                },
                {
                    "same_process_as_parent": True,
                    "op": "discover.endpoint",
                    "description": "resolve_conditions",
                    "span_id": self.span_ids_event_2["C"],
                    "trace_id": self.trace_id_2,
                    "parent_span_id": self.span_ids_event_2["A"],
                    "exclusive_time": 10,
                    "data": {
                        "duration": 0.00,
                        "offset": 0.015,
                        "span.group": "C",
                        "span.description": "connect",
                    },
                    "sentry_tags": {
                        "description": "connect",
                    },
                },
                {
                    "same_process_as_parent": True,
                    "op": "discover.snql",
                    "description": "resolve_orderby",
                    "span_id": self.span_ids_event_2["D"],
                    "trace_id": self.trace_id_2,
                    "parent_span_id": self.span_ids_event_2["C"],
                    "exclusive_time": 10,
                    "data": {
                        "duration": 0.00,
                        "offset": 0.050,
                        "span.group": "D",
                        "span.description": "resolve_orderby",
                    },
                    "sentry_tags": {
                        "description": "resolve_orderby",
                    },
                },
                {
                    "same_process_as_parent": True,
                    "op": "discover.snql",
                    "description": "resolve_orderby",
                    "span_id": self.span_ids_event_2["D2"],
                    "trace_id": self.trace_id_2,
                    "parent_span_id": self.span_ids_event_2["C"],
                    "exclusive_time": 20,
                    "data": {
                        "duration": 0.00,
                        "offset": 1.055,
                        "span.group": "D",
                        "span.description": "resolve_orderby",
                    },
                    "sentry_tags": {
                        "description": "resolve_orderby",
                    },
                },
                {
                    "same_process_as_parent": True,
                    "op": "discover.snql",
                    "description": "resolve_columns",
                    "span_id": self.span_ids_event_2["E"],
                    "trace_id": self.trace_id_2,
                    "parent_span_id": self.span_ids_event_2["C"],
                    "exclusive_time": 20,
                    "data": {
                        "duration": 0.00,
                        "offset": 0.057,
                        "span.description": "resolve_columns",
                    },
                },
            ],
            parent_span_id=None,
            project_id=self.project.id,
            duration=700,
            environment="development",
        )

        self.url = reverse(
            self.url_name,
            kwargs={"organization_slug": self.project.organization.slug},
        )

    @mock.patch("sentry.api.endpoints.organization_spans_aggregation.raw_snql_query")
    def test_simple(self, mock_query):
        mock_query.side_effect = [MOCK_SNUBA_RESPONSE]
        for backend in ["indexedSpans", "nodestore"]:
            with self.feature(self.FEATURES):
                response = self.client.get(
                    self.url,
                    data={"transaction": "api/0/foo", "backend": backend},
                    format="json",
                )

            assert response.data
            data = response.data
            root_fingerprint = hashlib.md5(b"e238e6c2e2466b07").hexdigest()[:16]
            assert root_fingerprint in data
            assert data[root_fingerprint]["count()"] == 2
            assert data[root_fingerprint]["description"] == "api/0/foo"
            assert round(data[root_fingerprint]["avg(duration)"]) == 850

            if backend == "indexedSpans":
                assert data[root_fingerprint]["samples"] == {
                    ("80fe542aea4945ffbe612646987ee449", "root_1"),
                    ("86b21833d1854d9b811000b91e7fccfa", "root_2"),
                }
            else:
                assert data[root_fingerprint]["samples"] == {
                    (self.root_event_1.event_id, self.span_ids_event_1["A"]),
                    (self.root_event_2.event_id, self.span_ids_event_2["A"]),
                }

            fingerprint = hashlib.md5(b"e238e6c2e2466b07-B").hexdigest()[:16]
            assert data[fingerprint]["description"] == "connect"
            assert round(data[fingerprint]["avg(duration)"]) == 30

            fingerprint = hashlib.md5(b"e238e6c2e2466b07-C-D").hexdigest()[:16]
            assert data[fingerprint]["description"] == "resolve_orderby"
            assert data[fingerprint]["avg(exclusive_time)"] == 15.0
            assert data[fingerprint]["count()"] == 2

            fingerprint = hashlib.md5(b"e238e6c2e2466b07-C-D2").hexdigest()[:16]
            assert data[fingerprint]["description"] == "resolve_orderby"
            assert data[fingerprint]["avg(exclusive_time)"] == 20.0
            assert data[fingerprint]["count()"] == 1

    @mock.patch("sentry.api.endpoints.organization_spans_aggregation.raw_snql_query")
    def test_offset_logic(self, mock_query):
        mock_query.side_effect = [MOCK_SNUBA_RESPONSE]
        for backend in ["indexedSpans", "nodestore"]:
            with self.feature(self.FEATURES):
                response = self.client.get(
                    self.url,
                    data={"transaction": "api/0/foo", "backend": backend},
                    format="json",
                )

            assert response.data
            data = response.data
            root_fingerprint = hashlib.md5(b"e238e6c2e2466b07").hexdigest()[:16]
            assert root_fingerprint in data
            assert data[root_fingerprint]["avg(absolute_offset)"] == 0.0

            fingerprint = hashlib.md5(b"e238e6c2e2466b07-B").hexdigest()[:16]
            assert data[fingerprint]["avg(absolute_offset)"] == 30.0

            fingerprint = hashlib.md5(b"e238e6c2e2466b07-C").hexdigest()[:16]
            assert data[fingerprint]["avg(absolute_offset)"] == 35.0

            fingerprint = hashlib.md5(b"e238e6c2e2466b07-C-D").hexdigest()[:16]
            assert data[fingerprint]["avg(absolute_offset)"] == 53.5

            fingerprint = hashlib.md5(b"e238e6c2e2466b07-C-D2").hexdigest()[:16]
            assert data[fingerprint]["avg(absolute_offset)"] == 1075.0

    @mock.patch("sentry.api.endpoints.organization_spans_aggregation.raw_snql_query")
    def test_null_group_fallback(self, mock_query):
        mock_query.side_effect = [MOCK_SNUBA_RESPONSE]
        for backend in ["indexedSpans", "nodestore"]:
            with self.feature(self.FEATURES):
                response = self.client.get(
                    self.url,
                    data={"transaction": "api/0/foo", "backend": backend},
                    format="json",
                )

            assert response.data
            data = response.data
            root_fingerprint = hashlib.md5(b"e238e6c2e2466b07-C-discover.snql").hexdigest()[:16]
            assert root_fingerprint in data
            assert data[root_fingerprint]["description"] == ""
            assert data[root_fingerprint]["count()"] == 2

    @mock.patch("sentry.api.endpoints.organization_spans_aggregation.raw_snql_query")
    def test_http_method_filter(self, mock_query):
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"transaction": "api/0/foo", "backend": "nodestore", "http.method": "GET"},
                format="json",
            )

        assert response.data
        data = response.data
        root_fingerprint = hashlib.md5(b"e238e6c2e2466b07").hexdigest()[:16]
        assert root_fingerprint in data
        assert data[root_fingerprint]["count()"] == 2

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={"transaction": "api/0/foo", "backend": "nodestore", "http.method": "POST"},
                format="json",
            )

        assert response.data == {}

        with self.feature(self.FEATURES):
            self.client.get(
                self.url,
                data={"transaction": "api/0/foo", "backend": "indexedSpans", "http.method": "GET"},
                format="json",
            )

            assert (
                Condition(
                    lhs=Function(
                        function="ifNull",
                        parameters=[
                            Column(
                                name="tags[transaction.method]",
                            ),
                            "",
                        ],
                        alias=None,
                    ),
                    op=Op.EQ,
                    rhs="GET",
                )
                in mock_query.mock_calls[0].args[0].query.where
            )

    def test_environment_filter(self):
        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "transaction": "api/0/foo",
                    "backend": "nodestore",
                    "environment": "production",
                },
                format="json",
            )

        assert response.data
        data = response.data
        root_fingerprint = hashlib.md5(b"e238e6c2e2466b07").hexdigest()[:16]
        assert root_fingerprint in data
        assert data[root_fingerprint]["count()"] == 1

        with self.feature(self.FEATURES):
            response = self.client.get(
                self.url,
                data={
                    "transaction": "api/0/foo",
                    "backend": "nodestore",
                    "environment": ["production", "development"],
                },
                format="json",
            )

        assert response.data
        data = response.data
        root_fingerprint = hashlib.md5(b"e238e6c2e2466b07").hexdigest()[:16]
        assert root_fingerprint in data
        assert data[root_fingerprint]["count()"] == 2
