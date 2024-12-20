from datetime import timedelta

from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data


class OrganizationEventsSpansHistogramEndpointTest(APITestCase, SnubaTestCase):
    FEATURES = ["organizations:performance-span-histogram-view"]
    URL = "sentry-api-0-organization-events-spans-histogram"

    def setUp(self):
        super().setUp()
        self.features = {}
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.url = reverse(
            self.URL,
            kwargs={"organization_id_or_slug": self.org.slug},
        )

        self.min_ago = before_now(minutes=1).replace(microsecond=0)

    def create_event(self, **kwargs):
        if "spans" not in kwargs:
            kwargs["spans"] = [
                {
                    "same_process_as_parent": True,
                    "parent_span_id": "a" * 16,
                    "span_id": x * 16,
                    "start_timestamp": (self.min_ago + timedelta(seconds=1)).isoformat(),
                    "timestamp": (self.min_ago + timedelta(seconds=4)).isoformat(),
                    "op": "django.middleware",
                    "description": "middleware span",
                    "exclusive_time": 3.0,
                }
                for x in ["b", "c"]
            ] + [
                {
                    "same_process_as_parent": True,
                    "parent_span_id": "a" * 16,
                    "span_id": x * 16,
                    "start_timestamp": (self.min_ago + timedelta(seconds=4)).isoformat(),
                    "timestamp": (self.min_ago + timedelta(seconds=5)).isoformat(),
                    "op": "django.middleware",
                    "description": "middleware span",
                    "exclusive_time": 10.0,
                }
                for x in ["d", "e", "f"]
            ]

        data = load_data("transaction", **kwargs)
        data["transaction"] = "root transaction"

        return self.store_event(data, project_id=self.project.id)

    def format_span(self, op, group):
        return f"{op}:{group}"

    def do_request(self, query, with_feature=True):
        features = self.FEATURES if with_feature else []
        with self.feature(features):
            return self.client.get(self.url, query, format="json")

    def test_no_feature(self):
        query = {
            "projects": [-1],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": 50,
        }
        response = self.do_request(query, False)
        assert response.status_code == 404

    def test_no_projects(self):
        query = {
            "projects": [-1],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": 50,
        }
        response = self.do_request(query)

        assert response.status_code == 200
        assert response.data == {}

    def test_bad_params_missing_span(self):
        query = {
            "project": [self.project.id],
            "numBuckets": 50,
        }

        response = self.do_request(query)

        assert response.status_code == 400
        assert response.data == {"span": [ErrorDetail("This field is required.", code="required")]}

    def test_bad_params_missing_num_buckets(self):
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
        }

        response = self.do_request(query)

        assert response.status_code == 400
        assert response.data == {
            "numBuckets": [ErrorDetail("This field is required.", code="required")]
        }

    def test_bad_params_invalid_num_buckets(self):
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": "foo",
        }

        response = self.do_request(query)

        assert response.status_code == 400, "failing for numBuckets"
        assert response.data == {
            "numBuckets": ["A valid integer is required."]
        }, "failing for numBuckets"

    def test_bad_params_outside_range_num_buckets(self):
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": -1,
        }

        response = self.do_request(query)

        assert response.status_code == 400, "failing for numBuckets"
        assert response.data == {
            "numBuckets": ["Ensure this value is greater than or equal to 1."]
        }, "failing for numBuckets"

    def test_bad_params_num_buckets_too_large(self):
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": 101,
        }

        response = self.do_request(query)

        assert response.status_code == 400, "failing for numBuckets"
        assert response.data == {
            "numBuckets": ["Ensure this value is less than or equal to 100."]
        }, "failing for numBuckets"

    def test_bad_params_invalid_precision_too_small(self):
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": 50,
            "precision": -1,
        }

        response = self.do_request(query)

        assert response.status_code == 400, "failing for precision"
        assert response.data == {
            "precision": ["Ensure this value is greater than or equal to 0."],
        }, "failing for precision"

    def test_bad_params_invalid_precision_too_big(self):
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": 50,
            "precision": 100,
        }

        response = self.do_request(query)
        assert response.status_code == 400, "failing for precision"
        assert response.data == {
            "precision": ["Ensure this value is less than or equal to 4."],
        }, "failing for precision"

    def test_bad_params_reverse_min_max(self):
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": 50,
            "min": 10,
            "max": 5,
        }

        response = self.do_request(query)
        assert response.data == {"non_field_errors": ["min cannot be greater than max."]}

    def test_bad_params_invalid_min(self):
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": 50,
            "min": "foo",
        }

        response = self.do_request(query)
        assert response.status_code == 400, "failing for min"
        assert response.data == {"min": ["A valid number is required."]}, "failing for min"

    def test_bad_params_invalid_max(self):
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": 50,
            "max": "bar",
        }

        response = self.do_request(query)
        assert response.status_code == 400, "failing for max"
        assert response.data == {"max": ["A valid number is required."]}, "failing for max"

    def test_bad_params_invalid_data_filter(self):
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": 50,
            "dataFilter": "invalid",
        }

        response = self.do_request(query)
        assert response.status_code == 400, "failing for dataFilter"
        assert response.data == {
            "dataFilter": ['"invalid" is not a valid choice.']
        }, "failing for dataFilter"

    def test_histogram_empty(self):
        num_buckets = 5
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.view", "2b9cbb96dbf59baa"),
            "numBuckets": num_buckets,
        }

        expected_empty_response = [{"bin": i, "count": 0} for i in range(num_buckets)]

        response = self.do_request(query)
        assert response.status_code == 200, response.content
        assert response.data == expected_empty_response

    def test_histogram(self):
        self.create_event()
        num_buckets = 50
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": num_buckets,
        }

        response = self.do_request(query)

        assert response.status_code == 200, response.content
        for bucket in response.data:
            if bucket["bin"] == 3:
                assert bucket["count"] == 2
            elif bucket["bin"] == 10:
                assert bucket["count"] == 3
            else:
                assert bucket["count"] == 0

    def test_histogram_using_min_max(self):
        self.create_event()
        num_buckets = 10
        min = 5
        max = 11
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": num_buckets,
            "min": min,
            "max": max,
        }

        response = self.do_request(query)

        assert response.status_code == 200, response.content
        for bucket in response.data:
            if bucket["bin"] == 10:
                assert bucket["count"] == 3
            else:
                assert bucket["count"] == 0
        assert response.data[0]["bin"] == min
        assert response.data[-1]["bin"] == max - 1

    def test_histogram_using_given_min_above_queried_max(self):
        self.create_event()
        num_buckets = 10
        min = 12
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": num_buckets,
            "min": min,
        }

        response = self.do_request(query)

        assert response.status_code == 200
        for bucket in response.data:
            assert bucket["count"] == 0
        assert response.data[0] == {"bin": min, "count": 0}
        assert len(response.data) == 1

    def test_histogram_using_given_max_below_queried_min(self):
        self.create_event()
        num_buckets = 10
        max = 2
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": num_buckets,
            "max": max,
        }

        response = self.do_request(query)

        assert response.status_code == 200
        for bucket in response.data:
            assert bucket["count"] == 0
        assert response.data[-1] == {"bin": max - 1, "count": 0}

    def test_histogram_all_data_filter(self):
        # populate with default spans
        self.create_event()

        spans = [
            {
                "same_process_as_parent": True,
                "parent_span_id": "a" * 16,
                "span_id": "e" * 16,
                "start_timestamp": (self.min_ago + timedelta(seconds=1)).isoformat(),
                "timestamp": (self.min_ago + timedelta(seconds=4)).isoformat(),
                "op": "django.middleware",
                "description": "middleware span",
                "exclusive_time": 60.0,
            }
        ]

        # populate with an outlier span
        self.create_event(spans=spans)
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": 10,
            "dataFilter": "all",
        }
        response = self.do_request(query)
        assert response.status_code == 200
        assert response.data[-1] == {"bin": 60, "count": 1}

    def test_histogram_exclude_outliers_data_filter(self):
        # populate with default spans
        self.create_event()

        spans = [
            {
                "same_process_as_parent": True,
                "parent_span_id": "a" * 16,
                "span_id": "e" * 16,
                "start_timestamp": (self.min_ago + timedelta(seconds=1)).isoformat(),
                "timestamp": (self.min_ago + timedelta(seconds=4)).isoformat(),
                "op": "django.middleware",
                "description": "middleware span",
                "exclusive_time": 60.0,
            }
        ]

        # populate with an outlier span
        self.create_event(spans=spans)
        query = {
            "project": [self.project.id],
            "span": self.format_span("django.middleware", "2b9cbb96dbf59baa"),
            "numBuckets": 10,
            "dataFilter": "exclude_outliers",
        }
        response = self.do_request(query)
        assert response.status_code == 200
        assert response.data[-1]["bin"] != 60
