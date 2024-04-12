from uuid import uuid4

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.testutils.cases import APITestCase, BaseSpansTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationTracesEndpointTest(BaseSpansTestCase, APITestCase):
    view = "sentry-api-0-organization-traces"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def do_request(self, query, **kwargs):
        return self.client.get(
            reverse(self.view, kwargs={"organization_slug": self.organization.slug}),
            query,
            format="json",
            **kwargs,
        )

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
                "fields": {
                    "id": "string",
                    "parent_span": "string",
                },
                "isMetricsData": False,
                "isMetricsExtractedData": False,
                "tips": {},
                "units": {
                    "id": None,
                    "parent_span": None,
                },
            },
        }

    def test_matching_tag(self):
        # Hack: ensure that no span ids with leading 0s are generated for the test
        span_ids = ["1" + uuid4().hex[:15] for _ in range(7)]
        timestamps = []

        trace_id_1 = uuid4().hex
        timestamps.append(before_now(days=0, minutes=10).replace(microsecond=0))
        self.store_segment(
            self.project.id,
            trace_id_1,
            uuid4().hex,
            span_id=span_ids[0],
            timestamp=timestamps[-1],
            transaction="foo",
            duration=60_100,
            exclusive_time=60_100,
        )
        for idx, i in enumerate(range(1, 4)):
            timestamps.append(before_now(days=0, minutes=9, seconds=45 - i).replace(microsecond=0))
            self.store_segment(
                self.project.id,
                trace_id_1,
                uuid4().hex,
                span_id=span_ids[i],
                parent_span_id=span_ids[0],
                timestamp=timestamps[-1],
                transaction="bar",
                duration=30_000,
                exclusive_time=30_000,
                tags={"foo": "bar" if idx != 0 else "baz"},
            )

        trace_id_2 = uuid4().hex
        timestamps.append(before_now(days=0, minutes=20).replace(microsecond=0))
        self.store_segment(
            self.project.id,
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
                self.project.id,
                trace_id_2,
                uuid4().hex,
                span_id=span_ids[i],
                parent_span_id=span_ids[4],
                timestamp=timestamps[-1],
                transaction="baz",
                duration=20_000,
                exclusive_time=20_000,
                tags={"foo": "bar"},
            )

        query = {
            "project": [self.project.id],
            "field": ["id", "parent_span"],
            "query": "foo:bar",
            "maxSpansPerTrace": 3,
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.data

        assert response.data["meta"] == {
            "dataset": "unknown",
            "datasetReason": "unchanged",
            "fields": {
                "id": "string",
                "parent_span": "string",
            },
            "isMetricsData": False,
            "isMetricsExtractedData": False,
            "tips": {},
            "units": {
                "id": None,
                "parent_span": None,
            },
        }

        result_data = sorted(response.data["data"], key=lambda trace: trace["trace"])
        for row in result_data:
            row["spans"].sort(key=lambda span: span["id"])

        assert result_data == sorted(
            [
                {
                    "trace": trace_id_1,
                    "numSpans": 4,
                    "name": "foo",
                    "duration": 60_100,
                    "spans": sorted(
                        [
                            # span_ids[1] does not match
                            {"id": span_ids[2], "parent_span": span_ids[0]},
                            {"id": span_ids[3], "parent_span": span_ids[0]},
                        ],
                        key=lambda span: span["id"],
                    ),
                },
                {
                    "trace": trace_id_2,
                    "numSpans": 3,
                    "name": "bar",
                    "duration": 90_123,
                    "spans": sorted(
                        [
                            {"id": span_ids[5], "parent_span": span_ids[4]},
                            {"id": span_ids[6], "parent_span": span_ids[4]},
                        ],
                        key=lambda span: span["id"],
                    ),
                },
            ],
            key=lambda trace: trace["trace"],  # type: ignore[arg-type, return-value]
        )
