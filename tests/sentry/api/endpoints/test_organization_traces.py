from datetime import timedelta
from uuid import uuid4

import pytest
from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.api.endpoints.organization_traces import process_breakdowns
from sentry.snuba.metrics.naming_layer.mri import SpanMRI, TransactionMRI
from sentry.testutils.cases import APITestCase, BaseSpansTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data


class OrganizationTracesEndpointTest(BaseSpansTestCase, APITestCase):
    view = "sentry-api-0-organization-traces"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def do_request(self, query, features=None, **kwargs):
        if features is None:
            features = ["organizations:performance-trace-explorer"]
        with self.feature(features):
            return self.client.get(
                reverse(self.view, kwargs={"organization_slug": self.organization.slug}),
                query,
                format="json",
                **kwargs,
            )

    def double_write_segment(
        self,
        *,
        project_id,
        trace_id,
        transaction_id,
        span_id,
        timestamp,
        duration,
        **kwargs,
    ):
        # first write to the transactions dataset
        end_timestamp = timestamp + timedelta(microseconds=duration * 1000)
        data = load_data(
            "transaction",
            start_timestamp=timestamp,
            timestamp=end_timestamp,
            trace=trace_id,
            span_id=span_id,
            spans=[],
            event_id=transaction_id,
        )
        data["measurements"] = {"lcp": {"value": duration}}
        if tags := kwargs.get("tags", {}):
            data["tags"] = [[key, val] for key, val in tags.items()]

        self.store_event(
            data=data,
            project_id=project_id,
        )

        self.store_segment(
            project_id=project_id,
            trace_id=trace_id,
            transaction_id=transaction_id,
            span_id=span_id,
            timestamp=timestamp,
            duration=duration,
            **kwargs,
        )

    def create_mock_traces(self):
        project_1 = self.create_project()
        project_2 = self.create_project()

        # Hack: ensure that no span ids with leading 0s are generated for the test
        span_ids = ["1" + uuid4().hex[:15] for _ in range(11)]
        tags = ["", "bar", "bar", "baz", "", "bar", "baz"]
        timestamps = []

        trace_id_1 = uuid4().hex
        timestamps.append(before_now(days=0, minutes=10).replace(microsecond=0))
        self.double_write_segment(
            project_id=project_1.id,
            trace_id=trace_id_1,
            transaction_id=uuid4().hex,
            span_id=span_ids[0],
            timestamp=timestamps[-1],
            transaction="foo",
            duration=60_100,
            exclusive_time=60_100,
        )
        for i in range(1, 4):
            timestamps.append(before_now(days=0, minutes=9, seconds=45 - i).replace(microsecond=0))
            self.double_write_segment(
                project_id=project_2.id,
                trace_id=trace_id_1,
                transaction_id=uuid4().hex,
                span_id=span_ids[i],
                parent_span_id=span_ids[0],
                timestamp=timestamps[-1],
                transaction="bar",
                duration=30_000 + i,
                exclusive_time=30_000 + i,
                tags={"foo": tags[i]},
            )

        trace_id_2 = uuid4().hex
        txn_id_2 = uuid4().hex
        timestamps.append(before_now(days=0, minutes=20).replace(microsecond=0))
        self.double_write_segment(
            project_id=project_1.id,
            trace_id=trace_id_2,
            transaction_id=txn_id_2,
            span_id=span_ids[4],
            timestamp=timestamps[-1],
            transaction="bar",
            duration=90_123,
            exclusive_time=90_123,
        )
        for i in range(5, 7):
            timestamps.append(before_now(days=0, minutes=19, seconds=55 - i).replace(microsecond=0))
            self.double_write_segment(
                project_id=project_2.id,
                trace_id=trace_id_2,
                transaction_id=uuid4().hex,
                span_id=span_ids[i],
                parent_span_id=span_ids[4],
                timestamp=timestamps[-1],
                transaction="baz",
                duration=20_000 + i,
                exclusive_time=20_000 + i,
                tags={"foo": tags[i]},
            )

        timestamps.append(before_now(days=0, minutes=19, seconds=59).replace(microsecond=0))
        self.store_indexed_span(
            project_id=project_1.id,
            trace_id=trace_id_2,
            transaction_id=txn_id_2,
            span_id=span_ids[7],
            parent_span_id=span_ids[4],
            timestamp=timestamps[-1],
            transaction="foo",
            duration=1_000,
            exclusive_time=1_000,
            op="http.client",
            category="http",
        )

        timestamps.append(before_now(days=0, minutes=19, seconds=40).replace(microsecond=0))
        self.store_indexed_span(
            project_id=project_1.id,
            trace_id=trace_id_2,
            transaction_id=txn_id_2,
            span_id=span_ids[8],
            parent_span_id=span_ids[4],
            timestamp=timestamps[-1],
            transaction="foo",
            duration=3_000,
            exclusive_time=3_000,
            op="db.sql",
            category="db",
        )

        timestamps.append(before_now(days=0, minutes=19, seconds=45).replace(microsecond=0))
        self.store_indexed_span(
            project_id=project_1.id,
            trace_id=trace_id_2,
            transaction_id=txn_id_2,
            span_id=span_ids[9],
            parent_span_id=span_ids[4],
            timestamp=timestamps[-1],
            transaction="foo",
            duration=3,
            exclusive_time=3,
            op="db.sql",
            category="db",
        )

        timestamps.append(before_now(days=0, minutes=20).replace(microsecond=0))
        trace_id_3 = uuid4().hex
        self.double_write_segment(
            project_id=project_1.id,
            trace_id=trace_id_3,
            transaction_id=uuid4().hex,
            span_id=span_ids[10],
            timestamp=timestamps[-1],
            transaction="qux",
            duration=40_000,
            tags={"foo": "qux"},
            measurements={
                measurement: 40_000
                for i, measurement in enumerate(
                    [
                        "score.total",
                        "score.inp",
                        "score.weight.inp",
                        "http.response_content_length",
                        "http.decoded_response_content_length",
                        "http.response_transfer_size",
                    ]
                )
            },
            store_metrics_summary={
                "d:custom/value@millisecond": [
                    {
                        "min": 40_000,
                        "max": 40_000,
                        "sum": 40_000,
                        "count": 1,
                        "tags": {"foo": "qux"},
                    }
                ]
            },
        )

        error_data = load_data("javascript", timestamp=timestamps[0])
        error_data["contexts"]["trace"] = {
            "type": "trace",
            "trace_id": trace_id_1,
            "span_id": span_ids[0],
        }
        error_data["tags"] = [["transaction", "foo"]]
        self.store_event(error_data, project_id=project_1.id)

        return (
            project_1,
            project_2,
            trace_id_1,
            trace_id_2,
            trace_id_3,
            timestamps,
            span_ids,
        )

    def test_no_feature(self):
        query = {
            "field": ["id"],
            "project": [self.project.id],
        }

        response = self.do_request(query, features=[])
        assert response.status_code == 404, response.data

    def test_no_project(self):
        query = {
            "field": ["id"],
            "project": [],
        }

        response = self.do_request(query)
        assert response.status_code == 404, response.data

    def test_bad_params_missing_fields(self):
        query = {
            "project": [self.project.id],
            "field": [],
            "maxSpansPerTrace": 0,
        }

        response = self.do_request(query)
        assert response.status_code == 400, response.data
        assert response.data == {
            "field": [
                ErrorDetail(string="This field is required.", code="required"),
            ],
            "maxSpansPerTrace": [
                ErrorDetail(
                    string="Ensure this value is greater than or equal to 1.", code="min_value"
                ),
            ],
        }

    def test_bad_params_too_few_spans_per_trace(self):
        query = {
            "project": [self.project.id],
            "field": ["id"],
            "maxSpansPerTrace": 0,
        }

        response = self.do_request(query)
        assert response.status_code == 400, response.data
        assert response.data == {
            "maxSpansPerTrace": [
                ErrorDetail(
                    string="Ensure this value is greater than or equal to 1.", code="min_value"
                ),
            ],
        }

    def test_bad_params_too_many_spans_per_trace(self):
        query = {
            "project": [self.project.id],
            "field": ["id"],
            "maxSpansPerTrace": 1000,
        }

        response = self.do_request(query)
        assert response.status_code == 400, response.data
        assert response.data == {
            "maxSpansPerTrace": [
                ErrorDetail(
                    string="Ensure this value is less than or equal to 100.", code="max_value"
                ),
            ],
        }

    def test_bad_params_too_many_per_page(self):
        query = {
            "project": [self.project.id],
            "field": ["id"],
            "per_page": 1000,
        }

        response = self.do_request(query)
        assert response.status_code == 400, response.data
        assert response.data == {
            "detail": ErrorDetail(
                string="Invalid per_page value. Cannot exceed 100.", code="parse_error"
            ),
        }

    def test_unsupported_mri(self):
        query = {
            "project": [self.project.id],
            "field": ["id"],
            "maxSpansPerTrace": 1,
            "mri": "d:spans/made_up@none",
        }

        response = self.do_request(query)
        assert response.status_code == 400, response.data
        assert response.data == {
            "detail": ErrorDetail(
                string="Unsupported MRI: d:spans/made_up@none", code="parse_error"
            ),
        }

    def test_no_traces(self):
        query = {
            "project": [self.project.id],
            "field": ["id", "parent_span"],
            "maxSpansPerTrace": 1,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data
        assert response.data == {
            "data": [],
            "meta": {
                "dataset": "unknown",
                "datasetReason": "unchanged",
                "fields": {},
                "isMetricsData": False,
                "isMetricsExtractedData": False,
                "tips": {},
                "units": {},
            },
        }

    def test_query_not_required(self):
        query = {
            "project": [self.project.id],
            "field": ["id"],
            "maxSpansPerTrace": 1,
            "query": [""],
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data

    def test_matching_tag(self):
        (
            project_1,
            project_2,
            trace_id_1,
            trace_id_2,
            _,
            timestamps,
            span_ids,
        ) = self.create_mock_traces()

        for q in [
            [
                "(foo:bar AND span.duration:>10s) OR (foo:bar AND span.duration:<10m)",
                "foo:baz",
            ],
            ["foo:[bar, baz]"],
        ]:
            query = {
                "project": [project_2.id],
                "field": ["id", "parent_span", "span.duration"],
                "query": q,
                "suggestedQuery": "foo:baz span.duration:>0s",
                "maxSpansPerTrace": 3,
                "sort": ["-span.duration"],
            }

            response = self.do_request(query)
            assert response.status_code == 200, response.data

            assert response.data["meta"] == {
                "dataset": "unknown",
                "datasetReason": "unchanged",
                "fields": {
                    "id": "string",
                    "parent_span": "string",
                    "span.duration": "duration",
                },
                "isMetricsData": False,
                "isMetricsExtractedData": False,
                "tips": {},
                "units": {
                    "id": None,
                    "parent_span": None,
                    "span.duration": "millisecond",
                },
            }

            result_data = sorted(response.data["data"], key=lambda trace: trace["trace"])

            assert result_data == sorted(
                [
                    {
                        "trace": trace_id_1,
                        "numErrors": 1,
                        "numOccurrences": 0,
                        "numSpans": 4,
                        "project": project_1.slug,
                        "name": "foo",
                        "duration": 60_100,
                        "start": int(timestamps[0].timestamp() * 1000),
                        "end": int(timestamps[0].timestamp() * 1000) + 60_100,
                        "breakdowns": [
                            {
                                "project": project_1.slug,
                                "opCategory": None,
                                "start": int(timestamps[0].timestamp() * 1000),
                                "end": int(timestamps[0].timestamp() * 1000) + 60_100,
                                "kind": "project",
                            },
                            {
                                "project": project_2.slug,
                                "opCategory": None,
                                "start": int(timestamps[1].timestamp() * 1000),
                                "end": int(timestamps[3].timestamp() * 1000) + 30_003,
                                "kind": "project",
                            },
                        ],
                        "spans": [
                            {
                                "id": span_ids[3],
                                "parent_span": span_ids[0],
                                "span.duration": 30_003.0,
                            },
                            {
                                "id": span_ids[2],
                                "parent_span": span_ids[0],
                                "span.duration": 30_002.0,
                            },
                            {
                                "id": span_ids[1],
                                "parent_span": span_ids[0],
                                "span.duration": 30_001.0,
                            },
                        ],
                        "suggestedSpans": [
                            {
                                "id": span_ids[3],
                                "parent_span": span_ids[0],
                                "span.duration": 30_003.0,
                            },
                        ],
                    },
                    {
                        "trace": trace_id_2,
                        "numErrors": 0,
                        "numOccurrences": 0,
                        "numSpans": 6,
                        "project": project_1.slug,
                        "name": "bar",
                        "duration": 90_123,
                        "start": int(timestamps[4].timestamp() * 1000),
                        "end": int(timestamps[4].timestamp() * 1000) + 90_123,
                        "breakdowns": [
                            {
                                "project": project_1.slug,
                                "opCategory": None,
                                "start": int(timestamps[4].timestamp() * 1000),
                                "end": int(timestamps[4].timestamp() * 1000) + 90_123,
                                "kind": "project",
                            },
                            {
                                "project": project_2.slug,
                                "opCategory": None,
                                "start": int(timestamps[5].timestamp() * 1000),
                                "end": int(timestamps[6].timestamp() * 1000) + 20_006,
                                "kind": "project",
                            },
                        ],
                        "spans": [
                            {
                                "id": span_ids[6],
                                "parent_span": span_ids[4],
                                "span.duration": 20_006.0,
                            },
                            {
                                "id": span_ids[5],
                                "parent_span": span_ids[4],
                                "span.duration": 20_005.0,
                            },
                        ],
                        "suggestedSpans": [
                            {
                                "id": span_ids[6],
                                "parent_span": span_ids[4],
                                "span.duration": 20_006.0,
                            },
                        ],
                    },
                ],
                key=lambda trace: trace["trace"],
            )

    def test_matching_tag_breakdown_with_category(self):
        (
            project_1,
            project_2,
            _,
            trace_id_2,
            _,
            timestamps,
            span_ids,
        ) = self.create_mock_traces()

        query = {
            "project": [project_1.id],
            "field": ["id", "parent_span", "span.duration"],
            "query": "span.category:[db,http]",
            "suggestedQuery": "span.category:[db,http]",
            "maxSpansPerTrace": 3,
            "sort": ["-span.duration"],
            "breakdownCategory": ["db", "http"],
            "minBreakdownDuration": 10,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data

        assert response.data["meta"] == {
            "dataset": "unknown",
            "datasetReason": "unchanged",
            "fields": {
                "id": "string",
                "parent_span": "string",
                "span.duration": "duration",
            },
            "isMetricsData": False,
            "isMetricsExtractedData": False,
            "tips": {},
            "units": {
                "id": None,
                "parent_span": None,
                "span.duration": "millisecond",
            },
        }

        assert response.data["data"] == [
            {
                "trace": trace_id_2,
                "numErrors": 0,
                "numOccurrences": 0,
                "numSpans": 6,
                "project": project_1.slug,
                "name": "bar",
                "duration": 90_123,
                "start": int(timestamps[4].timestamp() * 1000),
                "end": int(timestamps[4].timestamp() * 1000) + 90_123,
                "breakdowns": [
                    {
                        "project": project_1.slug,
                        "opCategory": None,
                        "start": int(timestamps[4].timestamp() * 1000),
                        "end": int(timestamps[4].timestamp() * 1000) + 90_123,
                        "kind": "project",
                    },
                    {
                        "project": project_1.slug,
                        "opCategory": "http",
                        "start": int(timestamps[7].timestamp() * 1000),
                        "end": int(timestamps[7].timestamp() * 1000) + 1_000,
                        "kind": "project",
                    },
                    {
                        "project": project_2.slug,
                        "opCategory": None,
                        "start": int(timestamps[5].timestamp() * 1000),
                        "end": int(timestamps[6].timestamp() * 1000) + 20_006,
                        "kind": "project",
                    },
                    {
                        "project": project_1.slug,
                        "opCategory": "db",
                        "start": int(timestamps[8].timestamp() * 1000),
                        "end": int(timestamps[8].timestamp() * 1000) + 3_000,
                        "kind": "project",
                    },
                ],
                "spans": [
                    {
                        "id": span_ids[8],
                        "parent_span": span_ids[4],
                        "span.duration": 3_000.0,
                    },
                    {
                        "id": span_ids[7],
                        "parent_span": span_ids[4],
                        "span.duration": 1_000.0,
                    },
                    {
                        "id": span_ids[9],
                        "parent_span": span_ids[4],
                        "span.duration": 3.0,
                    },
                ],
                "suggestedSpans": [],
            },
        ]

    def test_matching_tag_metrics(self):
        (
            project_1,
            _,
            _,
            _,
            trace_id_3,
            timestamps,
            span_ids,
        ) = self.create_mock_traces()

        for mri in [
            TransactionMRI.DURATION.value,
            "d:transactions/measurements.lcp@millisecond",
            SpanMRI.DURATION.value,
            SpanMRI.SELF_TIME.value,
            "d:spans/webvital.score.total@ratio",
            "d:spans/webvital.score.inp@ratio",
            "d:spans/webvital.score.weight.inp@ratio",
            "d:spans/http.response_content_length@byte",
            "d:spans/http.decoded_response_content_length@byte",
            "d:spans/http.response_transfer_size@byte",
            "d:custom/value@millisecond",
        ]:
            for user_query in ["foo:qux", None]:
                query = {
                    "mri": mri,
                    "metricsQuery": ["foo:qux"],
                    "project": [project_1.id],
                    "field": ["id", "parent_span", "span.duration"],
                    "suggestedQuery": ["foo:qux"],
                    "maxSpansPerTrace": 3,
                    "sort": ["-span.duration"],
                }
                if user_query:
                    query["query"] = user_query

                response = self.do_request(query)
                assert response.status_code == 200, (mri, response.data)

                result_data = sorted(response.data["data"], key=lambda trace: trace["trace"])

                assert result_data == [
                    {
                        "trace": trace_id_3,
                        "numErrors": 0,
                        "numOccurrences": 0,
                        "numSpans": 1,
                        "project": project_1.slug,
                        "name": "qux",
                        "duration": 40_000,
                        "start": int(timestamps[10].timestamp() * 1000),
                        "end": int(timestamps[10].timestamp() * 1000) + 40_000,
                        "breakdowns": [
                            {
                                "project": project_1.slug,
                                "opCategory": None,
                                "start": int(timestamps[10].timestamp() * 1000),
                                "end": int(timestamps[10].timestamp() * 1000) + 40_000,
                                "kind": "project",
                            },
                        ],
                        "spans": [
                            {
                                "id": span_ids[10],
                                "parent_span": "00",
                                "span.duration": 40_000.0,
                            },
                        ],
                        "suggestedSpans": []
                        if user_query
                        else [
                            {
                                "id": span_ids[10],
                                "parent_span": "00",
                                "span.duration": 40_000.0,
                            },
                        ],
                    },
                ], (mri, user_query)

    def test_matching_tag_metrics_but_no_matching_spans(self):
        for mri in [
            TransactionMRI.DURATION.value,
            "d:transactions/measurements.lcp@millisecond",
            SpanMRI.DURATION.value,
            SpanMRI.SELF_TIME.value,
            "d:spans/webvital.score.total@ratio",
            "d:spans/webvital.score.inp@ratio",
            "d:spans/webvital.score.weight.inp@ratio",
            "d:spans/http.response_content_length@byte",
            "d:spans/http.decoded_response_content_length@byte",
            "d:spans/http.response_transfer_size@byte",
            "d:custom/value@millisecond",
        ]:
            for user_query in ["foo:qux", None]:
                query = {
                    "mri": mri,
                    "metricsQuery": ["foo:qux"],
                    "project": [self.project.id],
                    "field": ["id", "parent_span", "span.duration"],
                    "query": "foo:foobar",
                    "suggestedQuery": ["foo:qux"],
                    "maxSpansPerTrace": 3,
                    "sort": ["-span.duration"],
                }

                response = self.do_request(query)
                assert response.status_code == 200, (mri, response.data)
                assert response.data == {
                    "data": [],
                    "meta": {
                        "dataset": "unknown",
                        "datasetReason": "unchanged",
                        "fields": {},
                        "isMetricsData": False,
                        "isMetricsExtractedData": False,
                        "tips": {},
                        "units": {},
                    },
                }


@pytest.mark.parametrize(
    ["data", "traces_range", "expected"],
    [
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.1,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 0,
                        "end": 100,
                        "kind": "project",
                    },
                ],
            },
            id="single transaction",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.1,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "precise.start_ts": 0.025,
                    "precise.finish_ts": 0.075,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 0,
                        "end": 100,
                        "kind": "project",
                    },
                    {
                        "project": "bar",
                        "opCategory": None,
                        "start": 25,
                        "end": 75,
                        "kind": "project",
                    },
                ],
            },
            id="two transactions different project nested",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.05,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "precise.start_ts": 0.025,
                    "precise.finish_ts": 0.075,
                },
                {
                    "trace": "a" * 32,
                    "project": "baz",
                    "transaction": "baz1",
                    "precise.start_ts": 0.05,
                    "precise.finish_ts": 0.1,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 0,
                        "end": 50,
                        "kind": "project",
                    },
                    {
                        "project": "bar",
                        "opCategory": None,
                        "start": 25,
                        "end": 75,
                        "kind": "project",
                    },
                    {
                        "project": "baz",
                        "opCategory": None,
                        "start": 50,
                        "end": 100,
                        "kind": "project",
                    },
                ],
            },
            id="three transactions different project overlapping",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.025,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "precise.start_ts": 0.05,
                    "precise.finish_ts": 0.075,
                },
            ],
            {"a" * 32: (0, 75)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 0,
                        "end": 25,
                        "kind": "project",
                    },
                    {
                        "project": None,
                        "opCategory": None,
                        "start": 25,
                        "end": 50,
                        "kind": "missing",
                    },
                    {
                        "project": "bar",
                        "opCategory": None,
                        "start": 50,
                        "end": 75,
                        "kind": "project",
                    },
                ],
            },
            id="two transactions different project non overlapping",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.1,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo2",
                    "precise.start_ts": 0.025,
                    "precise.finish_ts": 0.075,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 0,
                        "end": 100,
                        "kind": "project",
                    },
                ],
            },
            id="two transactions same project nested",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.075,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo2",
                    "precise.start_ts": 0.025,
                    "precise.finish_ts": 0.1,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 0,
                        "end": 100,
                        "kind": "project",
                    },
                ],
            },
            id="two transactions same project overlapping",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.025,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo2",
                    "precise.start_ts": 0.05,
                    "precise.finish_ts": 0.075,
                },
            ],
            {"a" * 32: (0, 75)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 0,
                        "end": 25,
                        "kind": "project",
                    },
                    {
                        "project": None,
                        "opCategory": None,
                        "start": 25,
                        "end": 50,
                        "kind": "missing",
                    },
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 50,
                        "end": 75,
                        "kind": "project",
                    },
                ],
            },
            id="two transactions same project non overlapping",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.1,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "precise.start_ts": 0.02,
                    "precise.finish_ts": 0.08,
                },
                {
                    "trace": "a" * 32,
                    "project": "baz",
                    "transaction": "baz1",
                    "precise.start_ts": 0.04,
                    "precise.finish_ts": 0.06,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 0,
                        "end": 100,
                        "kind": "project",
                    },
                    {
                        "project": "bar",
                        "opCategory": None,
                        "start": 20,
                        "end": 80,
                        "kind": "project",
                    },
                    {
                        "project": "baz",
                        "opCategory": None,
                        "start": 40,
                        "end": 60,
                        "kind": "project",
                    },
                ],
            },
            id="three transactions different project nested",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.1,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "precise.start_ts": 0.025,
                    "precise.finish_ts": 0.05,
                },
                {
                    "trace": "a" * 32,
                    "project": "baz",
                    "transaction": "baz1",
                    "precise.start_ts": 0.05,
                    "precise.finish_ts": 0.075,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 0,
                        "end": 100,
                        "kind": "project",
                    },
                    {
                        "project": "bar",
                        "opCategory": None,
                        "start": 25,
                        "end": 50,
                        "kind": "project",
                    },
                    {
                        "project": "baz",
                        "opCategory": None,
                        "start": 50,
                        "end": 75,
                        "kind": "project",
                    },
                ],
            },
            id="three transactions different project 2 overlap the first",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.05,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "precise.start_ts": 0.02,
                    "precise.finish_ts": 0.03,
                },
                {
                    "trace": "a" * 32,
                    "project": "baz",
                    "transaction": "baz1",
                    "precise.start_ts": 0.05,
                    "precise.finish_ts": 0.075,
                },
            ],
            {"a" * 32: (0, 75)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 0,
                        "end": 50,
                        "kind": "project",
                    },
                    {
                        "project": "bar",
                        "opCategory": None,
                        "start": 20,
                        "end": 30,
                        "kind": "project",
                    },
                    {
                        "project": "baz",
                        "opCategory": None,
                        "start": 50,
                        "end": 75,
                        "kind": "project",
                    },
                ],
            },
            id="three transactions different project 1 overlap the first and other non overlap",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.05,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "precise.start_ts": 0.02,
                    "precise.finish_ts": 0.03,
                },
                {
                    "trace": "a" * 32,
                    "project": "baz",
                    "transaction": "baz1",
                    "precise.start_ts": 0.04,
                    "precise.finish_ts": 0.06,
                },
            ],
            {"a" * 32: (0, 60)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 0,
                        "end": 50,
                        "kind": "project",
                    },
                    {
                        "project": "bar",
                        "opCategory": None,
                        "start": 20,
                        "end": 30,
                        "kind": "project",
                    },
                    {
                        "project": "baz",
                        "opCategory": None,
                        "start": 40,
                        "end": 60,
                        "kind": "project",
                    },
                ],
            },
            id="three transactions different project 2 overlap and second extend past parent",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.05,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "precise.start_ts": 0.01,
                    "precise.finish_ts": 0.02,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0.03,
                    "precise.finish_ts": 0.04,
                },
            ],
            {"a" * 32: (0, 50)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 0,
                        "end": 50,
                        "kind": "project",
                    },
                    {
                        "project": "bar",
                        "opCategory": None,
                        "start": 10,
                        "end": 20,
                        "kind": "project",
                    },
                ],
            },
            id="three transactions same project with another project between",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.1,
                },
            ],
            {"a" * 32: (0, 50)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 0,
                        "end": 50,
                        "kind": "project",
                    },
                ],
            },
            id="clips intervals to be within trace",
        ),
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "precise.start_ts": 0,
                    "precise.finish_ts": 0.05,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "opCategory": None,
                        "start": 0,
                        "end": 50,
                        "kind": "project",
                    },
                    {
                        "project": None,
                        "opCategory": None,
                        "start": 50,
                        "end": 100,
                        "kind": "other",
                    },
                ],
            },
            id="adds other interval at end",
        ),
    ],
)
def test_process_breakdowns(data, traces_range, expected):
    result = process_breakdowns(data, traces_range)
    assert result == expected
