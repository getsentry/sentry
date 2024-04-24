from uuid import uuid4

import pytest
from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.api.endpoints.organization_traces import process_breakdowns
from sentry.testutils.cases import APITestCase, BaseSpansTestCase
from sentry.testutils.helpers.datetime import before_now


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
        project_1 = self.create_project()
        project_2 = self.create_project()

        # Hack: ensure that no span ids with leading 0s are generated for the test
        span_ids = ["1" + uuid4().hex[:15] for _ in range(7)]
        tags = ["", "bar", "bar", "baz", "", "bar", "baz"]
        timestamps = []

        trace_id_1 = uuid4().hex
        timestamps.append(before_now(days=0, minutes=10).replace(microsecond=0))
        self.store_segment(
            project_1.id,
            trace_id_1,
            uuid4().hex,
            span_id=span_ids[0],
            timestamp=timestamps[-1],
            transaction="foo",
            duration=60_100,
            exclusive_time=60_100,
        )
        for i in range(1, 4):
            timestamps.append(before_now(days=0, minutes=9, seconds=45 - i).replace(microsecond=0))
            self.store_segment(
                project_2.id,
                trace_id_1,
                uuid4().hex,
                span_id=span_ids[i],
                parent_span_id=span_ids[0],
                timestamp=timestamps[-1],
                transaction="bar",
                duration=30_000 + i,
                exclusive_time=30_000 + i,
                tags={"foo": tags[i]},
            )

        trace_id_2 = uuid4().hex
        timestamps.append(before_now(days=0, minutes=20).replace(microsecond=0))
        self.store_segment(
            project_1.id,
            trace_id_2,
            uuid4().hex,
            span_id=span_ids[4],
            timestamp=timestamps[-1],
            transaction="bar",
            duration=90_123,
            exclusive_time=90_123,
        )
        for i in range(5, 7):
            timestamps.append(before_now(days=0, minutes=19, seconds=55 - i).replace(microsecond=0))
            self.store_segment(
                project_2.id,
                trace_id_2,
                uuid4().hex,
                span_id=span_ids[i],
                parent_span_id=span_ids[4],
                timestamp=timestamps[-1],
                transaction="baz",
                duration=20_000 + i,
                exclusive_time=20_000 + i,
                tags={"foo": tags[i]},
            )

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
                        "numSpans": 4,
                        "name": "foo",
                        "duration": 60_100,
                        "start": int(timestamps[0].timestamp() * 1000),
                        "end": int(timestamps[0].timestamp() * 1000) + 60_100,
                        "breakdowns": [
                            {
                                "project": project_1.slug,
                                "start": int(timestamps[0].timestamp() * 1000),
                                "end": int(timestamps[0].timestamp() * 1000) + 60_100,
                                "kind": "project",
                            },
                            {
                                "project": project_2.slug,
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
                        "numSpans": 3,
                        "name": "bar",
                        "duration": 90_123,
                        "start": int(timestamps[4].timestamp() * 1000),
                        "end": int(timestamps[4].timestamp() * 1000) + 90_123,
                        "breakdowns": [
                            {
                                "project": project_1.slug,
                                "start": int(timestamps[4].timestamp() * 1000),
                                "end": int(timestamps[4].timestamp() * 1000) + 90_123,
                                "kind": "project",
                            },
                            {
                                "project": project_2.slug,
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
                key=lambda trace: trace["trace"],  # type: ignore[arg-type, return-value]
            )


@pytest.mark.parametrize(
    ["data", "traces_range", "expected"],
    [
        pytest.param(
            [
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "first_seen()": 0,
                    "last_seen()": 100,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
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
                    "first_seen()": 0,
                    "last_seen()": 100,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "first_seen()": 25,
                    "last_seen()": 75,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "start": 0,
                        "end": 100,
                        "kind": "project",
                    },
                    {
                        "project": "bar",
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
                    "first_seen()": 0,
                    "last_seen()": 50,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "first_seen()": 25,
                    "last_seen()": 75,
                },
                {
                    "trace": "a" * 32,
                    "project": "baz",
                    "transaction": "baz1",
                    "first_seen()": 50,
                    "last_seen()": 100,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "start": 0,
                        "end": 50,
                        "kind": "project",
                    },
                    {
                        "project": "bar",
                        "start": 25,
                        "end": 75,
                        "kind": "project",
                    },
                    {
                        "project": "baz",
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
                    "first_seen()": 0,
                    "last_seen()": 25,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "first_seen()": 50,
                    "last_seen()": 75,
                },
            ],
            {"a" * 32: (0, 75)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "start": 0,
                        "end": 25,
                        "kind": "project",
                    },
                    {
                        "project": None,
                        "start": 25,
                        "end": 50,
                        "kind": "missing",
                    },
                    {
                        "project": "bar",
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
                    "first_seen()": 0,
                    "last_seen()": 100,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo2",
                    "first_seen()": 25,
                    "last_seen()": 75,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
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
                    "first_seen()": 0,
                    "last_seen()": 75,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo2",
                    "first_seen()": 25,
                    "last_seen()": 100,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
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
                    "first_seen()": 0,
                    "last_seen()": 25,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo2",
                    "first_seen()": 50,
                    "last_seen()": 75,
                },
            ],
            {"a" * 32: (0, 75)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "start": 0,
                        "end": 25,
                        "kind": "project",
                    },
                    {
                        "project": None,
                        "start": 25,
                        "end": 50,
                        "kind": "missing",
                    },
                    {
                        "project": "foo",
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
                    "first_seen()": 0,
                    "last_seen()": 100,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "first_seen()": 20,
                    "last_seen()": 80,
                },
                {
                    "trace": "a" * 32,
                    "project": "baz",
                    "transaction": "baz1",
                    "first_seen()": 40,
                    "last_seen()": 60,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "start": 0,
                        "end": 100,
                        "kind": "project",
                    },
                    {
                        "project": "bar",
                        "start": 20,
                        "end": 80,
                        "kind": "project",
                    },
                    {
                        "project": "baz",
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
                    "first_seen()": 0,
                    "last_seen()": 100,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "first_seen()": 25,
                    "last_seen()": 50,
                },
                {
                    "trace": "a" * 32,
                    "project": "baz",
                    "transaction": "baz1",
                    "first_seen()": 50,
                    "last_seen()": 75,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "start": 0,
                        "end": 100,
                        "kind": "project",
                    },
                    {
                        "project": "bar",
                        "start": 25,
                        "end": 50,
                        "kind": "project",
                    },
                    {
                        "project": "baz",
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
                    "first_seen()": 0,
                    "last_seen()": 50,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "first_seen()": 20,
                    "last_seen()": 30,
                },
                {
                    "trace": "a" * 32,
                    "project": "baz",
                    "transaction": "baz1",
                    "first_seen()": 50,
                    "last_seen()": 75,
                },
            ],
            {"a" * 32: (0, 75)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "start": 0,
                        "end": 50,
                        "kind": "project",
                    },
                    {
                        "project": "bar",
                        "start": 20,
                        "end": 30,
                        "kind": "project",
                    },
                    {
                        "project": "baz",
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
                    "first_seen()": 0,
                    "last_seen()": 50,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "first_seen()": 20,
                    "last_seen()": 30,
                },
                {
                    "trace": "a" * 32,
                    "project": "baz",
                    "transaction": "baz1",
                    "first_seen()": 40,
                    "last_seen()": 60,
                },
            ],
            {"a" * 32: (0, 60)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "start": 0,
                        "end": 50,
                        "kind": "project",
                    },
                    {
                        "project": "bar",
                        "start": 20,
                        "end": 30,
                        "kind": "project",
                    },
                    {
                        "project": "baz",
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
                    "first_seen()": 0,
                    "last_seen()": 50,
                },
                {
                    "trace": "a" * 32,
                    "project": "bar",
                    "transaction": "bar1",
                    "first_seen()": 10,
                    "last_seen()": 20,
                },
                {
                    "trace": "a" * 32,
                    "project": "foo",
                    "transaction": "foo1",
                    "first_seen()": 30,
                    "last_seen()": 40,
                },
            ],
            {"a" * 32: (0, 50)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "start": 0,
                        "end": 50,
                        "kind": "project",
                    },
                    {
                        "project": "bar",
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
                    "first_seen()": 0,
                    "last_seen()": 100,
                },
            ],
            {"a" * 32: (0, 50)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
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
                    "first_seen()": 0,
                    "last_seen()": 50,
                },
            ],
            {"a" * 32: (0, 100)},
            {
                "a"
                * 32: [
                    {
                        "project": "foo",
                        "start": 0,
                        "end": 50,
                        "kind": "project",
                    },
                    {
                        "project": None,
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
