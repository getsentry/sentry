from __future__ import annotations

import random
from collections import namedtuple
from copy import deepcopy
from datetime import timedelta

import pytest
from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.sentry_metrics.aggregation_option_registry import AggregationOption
from sentry.testutils.cases import APITestCase, MetricsEnhancedPerformanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data
from sentry.utils.snuba import get_array_column_alias

pytestmark = pytest.mark.sentry_metrics

HistogramSpec = namedtuple(
    "HistogramSpec", ["start", "end", "fields", "tags"], defaults=[None, None, [], {}]
)

ARRAY_COLUMNS = ["measurements", "span_op_breakdowns"]


class OrganizationEventsHistogramEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.data = load_data("transaction")
        self.features = {}

    def populate_events(self, specs):
        start = before_now(minutes=5)
        for spec in specs:
            spec = HistogramSpec(*spec)
            for suffix_key, count in spec.fields:
                for i in range(count):
                    data = deepcopy(self.data)

                    measurement_name = suffix_key
                    breakdown_name = f"ops.{suffix_key}"

                    data["timestamp"] = start.isoformat()
                    data["start_timestamp"] = (start - timedelta(seconds=i)).isoformat()
                    value = random.random() * (spec.end - spec.start) + spec.start
                    data["transaction"] = f"/measurement/{measurement_name}/value/{value}"

                    data["measurements"] = {measurement_name: {"value": value}}
                    data["breakdowns"] = {
                        "span_ops": {
                            breakdown_name: {"value": value},
                        }
                    }
                    self.store_event(data, self.project.id)

    def as_response_data(self, specs):
        data: dict[str, list[dict[str, int]]] = {}
        for spec in specs:
            spec = HistogramSpec(*spec)
            for measurement, count in sorted(spec.fields):
                if measurement not in data:
                    data[measurement] = []
                data[measurement].append({"bin": spec.start, "count": count})
        return data

    def do_request(self, query, features=None):
        if features is None:
            features = {"organizations:performance-view": True}
        features.update(self.features)
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-events-histogram",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        with self.feature(features):
            return self.client.get(url, query, format="json")

    def test_no_projects(self):
        response = self.do_request({})

        assert response.status_code == 200, response.content
        assert response.data == {}

    @pytest.mark.querybuilder
    def test_good_params(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "query": "event.type:transaction",
                "project": [self.project.id],
                "field": [f"{alias}.foo", f"{alias}.bar"],
                "numBuckets": 10,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"

    def test_good_params_with_optionals(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "query": "event.type:transaction",
                "project": [self.project.id],
                "field": [f"{alias}.foo", f"{alias}.bar"],
                "numBuckets": 10,
                "precision": 0,
                "min": 0,
                "max": 10,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"

    def test_bad_params_reverse_min_max(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "query": "event.type:transaction",
                "project": [self.project.id],
                "field": [f"{alias}.foo", f"{alias}.bar"],
                "numBuckets": 10,
                "precision": 0,
                "min": 10,
                "max": 5,
            }

            response = self.do_request(query)
            assert response.data == {"non_field_errors": ["min cannot be greater than max."]}

    def test_bad_params_missing_fields(self):
        query = {
            "project": [self.project.id],
            "numBuckets": 10,
        }

        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "field": [ErrorDetail(string="This field is required.", code="required")],
        }

    def test_bad_params_too_many_fields(self):
        query = {
            "project": [self.project.id],
            "field": ["foo", "bar", "baz", "qux", "quux"],
            "numBuckets": 10,
            "min": 0,
            "max": 100,
            "precision": 0,
        }

        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "field": ["Ensure this field has no more than 4 elements."],
        }

    def test_bad_params_mixed_fields(self):
        for array_column in ARRAY_COLUMNS:
            for other_array_column in ARRAY_COLUMNS:
                query = {
                    "project": [self.project.id],
                    "field": [
                        "foo",
                        f"{get_array_column_alias(array_column)}.foo",
                        f"{get_array_column_alias(other_array_column)}.bar",
                    ],
                    "numBuckets": 10,
                    "min": 0,
                    "max": 100,
                    "precision": 0,
                }

                response = self.do_request(query)
                assert response.status_code == 400, f"failing for {array_column}"
                assert response.data == {
                    "field": [
                        "You can only generate histogram for one column at a time unless they are all measurements or all span op breakdowns."
                    ],
                }, f"failing for {array_column}"

    def test_bad_params_missing_num_buckets(self):
        query = {
            "project": [self.project.id],
            "field": ["foo"],
        }
        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "numBuckets": ["This field is required."],
        }

    def test_bad_params_invalid_num_buckets(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo", f"{alias}.bar"],
                "numBuckets": "baz",
            }
            response = self.do_request(query)
            assert response.status_code == 400, f"failing for {array_column}"
            assert response.data == {
                "numBuckets": ["A valid integer is required."],
            }, f"failing for {array_column}"

    def test_bad_params_invalid_negative_num_buckets(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo", f"{alias}.bar"],
                "numBuckets": -1,
            }
            response = self.do_request(query)
            assert response.status_code == 400, f"failing for {array_column}"
            assert response.data == {
                "numBuckets": ["Ensure this value is greater than or equal to 1."],
            }, f"failing for {array_column}"

    def test_bad_params_num_buckets_too_large(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo", f"{alias}.bar"],
                "numBuckets": 150,
            }
            response = self.do_request(query)
            assert response.status_code == 400, f"failing for {array_column}"
            assert response.data == {
                "numBuckets": ["Ensure this value is less than or equal to 100."],
            }, f"failing for {array_column}"

    def test_bad_params_invalid_precision_too_small(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo", f"{alias}.bar"],
                "numBuckets": 10,
                "precision": -1,
            }

            response = self.do_request(query)
            assert response.status_code == 400, f"failing for {array_column}"
            assert response.data == {
                "precision": ["Ensure this value is greater than or equal to 0."],
            }, f"failing for {array_column}"

    def test_bad_params_invalid_precision_too_big(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo", f"{alias}.bar"],
                "numBuckets": 10,
                "precision": 100,
            }

            response = self.do_request(query)
            assert response.status_code == 400, f"failing for {array_column}"
            assert response.data == {
                "precision": ["Ensure this value is less than or equal to 4."],
            }, f"failing for {array_column}"

    def test_bad_params_invalid_min(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo", f"{alias}.bar"],
                "numBuckets": 10,
                "min": "qux",
            }

            response = self.do_request(query)
            assert response.status_code == 400, f"failing for {array_column}"
            assert response.data == {
                "min": ["A valid number is required."],
            }, f"failing for {array_column}"

    def test_bad_params_invalid_max(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo", f"{alias}.bar"],
                "numBuckets": 10,
                "max": "qux",
            }

            response = self.do_request(query)
            assert response.status_code == 400, f"failing for {array_column}"
            assert response.data == {
                "max": ["A valid number is required."],
            }, f"failing for {array_column}"

    def test_histogram_empty(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo", f"{alias}.bar"],
                "numBuckets": 5,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [(i, i + 1, [(f"{alias}.foo", 0), (f"{alias}.bar", 0)]) for i in range(5)]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_simple(self):
        # range is [0, 5), so it is divided into 5 buckets of width 1
        specs = [
            (0, 1, [("foo", 1)]),
            (1, 2, [("foo", 1)]),
            (2, 3, [("foo", 1)]),
            (4, 5, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (0, 1, [(f"{alias}.foo", 1)]),
                (1, 2, [(f"{alias}.foo", 1)]),
                (2, 3, [(f"{alias}.foo", 1)]),
                (3, 4, [(f"{alias}.foo", 0)]),
                (4, 5, [(f"{alias}.foo", 1)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_simple_using_min_max(self):
        # range is [0, 5), so it is divided into 5 buckets of width 1
        specs = [
            (0, 1, [("foo", 1)]),
            (1, 2, [("foo", 1)]),
            (2, 3, [("foo", 1)]),
            (4, 5, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
                "min": 0,
                "max": 5,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (0, 1, [(f"{alias}.foo", 1)]),
                (1, 2, [(f"{alias}.foo", 1)]),
                (2, 3, [(f"{alias}.foo", 1)]),
                (3, 4, [(f"{alias}.foo", 0)]),
                (4, 5, [(f"{alias}.foo", 1)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_simple_using_given_min_above_queried_max(self):
        # All these events are out of range of the query parameters,
        # and should not appear in the results.
        specs = [
            (0, 1, [("foo", 1)]),
            (1, 2, [("foo", 1)]),
            (2, 3, [("foo", 1)]),
            (4, 5, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
                "min": 6,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (6, 7, [(f"{alias}.foo", 0)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_simple_using_given_max_below_queried_min(self):
        # All these events are out of range of the query parameters,
        # and should not appear in the results.
        specs = [
            (6, 7, [("foo", 1)]),
            (8, 9, [("foo", 1)]),
            (10, 11, [("foo", 1)]),
            (12, 13, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
                "max": 6,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (5, 6, [(f"{alias}.foo", 0)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_large_buckets(self):
        # make sure that it works for large width buckets
        # range is [0, 99], so it is divided into 5 buckets of width 20
        specs = [
            (0, 0, [("foo", 2)]),
            (99, 99, [("foo", 2)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (0, 20, [(f"{alias}.foo", 2)]),
                (20, 40, [(f"{alias}.foo", 0)]),
                (40, 60, [(f"{alias}.foo", 0)]),
                (60, 80, [(f"{alias}.foo", 0)]),
                (80, 100, [(f"{alias}.foo", 2)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_non_zero_offset(self):
        # range is [10, 15), so it is divided into 5 buckets of width 1
        specs = [
            (10, 11, [("foo", 1)]),
            (12, 13, [("foo", 1)]),
            (13, 14, [("foo", 1)]),
            (14, 15, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (10, 11, [(f"{alias}.foo", 1)]),
                (11, 12, [(f"{alias}.foo", 0)]),
                (12, 13, [(f"{alias}.foo", 1)]),
                (13, 14, [(f"{alias}.foo", 1)]),
                (14, 15, [(f"{alias}.foo", 1)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_extra_data(self):
        # range is [11, 16), so it is divided into 5 buckets of width 1
        # make sure every bin has some value
        specs = [
            (10, 11, [("foo", 1)]),
            (11, 12, [("foo", 1)]),
            (12, 13, [("foo", 1)]),
            (13, 14, [("foo", 1)]),
            (14, 15, [("foo", 1)]),
            (15, 16, [("foo", 1)]),
            (16, 17, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
                "min": 11,
                "max": 16,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (11, 12, [(f"{alias}.foo", 1)]),
                (12, 13, [(f"{alias}.foo", 1)]),
                (13, 14, [(f"{alias}.foo", 1)]),
                (14, 15, [(f"{alias}.foo", 1)]),
                (15, 16, [(f"{alias}.foo", 1)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_non_zero_min_large_buckets(self):
        # range is [10, 59], so it is divided into 5 buckets of width 10
        specs = [
            (10, 10, [("foo", 1)]),
            (40, 50, [("foo", 1)]),
            (59, 59, [("foo", 2)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (10, 20, [(f"{alias}.foo", 1)]),
                (20, 30, [(f"{alias}.foo", 0)]),
                (30, 40, [(f"{alias}.foo", 0)]),
                (40, 50, [(f"{alias}.foo", 1)]),
                (50, 60, [(f"{alias}.foo", 2)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    @pytest.mark.xfail(reason="snuba does not allow - in alias names")
    def test_histogram_negative_values(self):
        # range is [-9, -4), so it is divided into 5 buckets of width 1
        specs = [
            (-9, -8, [("foo", 3)]),
            (-5, -4, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (-9, -8, [(f"{alias}.foo", 3)]),
                (-8, -7, [(f"{alias}.foo", 0)]),
                (-7, -6, [(f"{alias}.foo", 0)]),
                (-6, -5, [(f"{alias}.foo", 0)]),
                (-5, -4, [(f"{alias}.foo", 1)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    @pytest.mark.xfail(reason="snuba does not allow - in alias names")
    def test_histogram_positive_and_negative_values(self):
        # range is [-50, 49], so it is divided into 5 buckets of width 10
        specs = [
            (-50, -50, [("foo", 1)]),
            (-10, 10, [("foo", 2)]),
            (49, 49, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (-50, -30, [(f"{alias}.foo", 1)]),
                (-30, -10, [(f"{alias}.foo", 0)]),
                (-10, 10, [(f"{alias}.foo", 2)]),
                (10, 30, [(f"{alias}.foo", 0)]),
                (30, 50, [(f"{alias}.foo", 1)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_increased_precision(self):
        # range is [1.00, 2.24], so it is divided into 5 buckets of width 0.25
        specs = [
            (1.00, 1.00, [("foo", 3)]),
            (2.24, 2.24, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
                "precision": 2,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (1.00, 1.25, [(f"{alias}.foo", 3)]),
                (1.25, 1.50, [(f"{alias}.foo", 0)]),
                (1.50, 1.75, [(f"{alias}.foo", 0)]),
                (1.75, 2.00, [(f"{alias}.foo", 0)]),
                (2.00, 2.25, [(f"{alias}.foo", 1)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_increased_precision_with_min_max(self):
        # range is [1.25, 2.24], so it is divided into 5 buckets of width 0.25
        specs = [
            (1.00, 1.25, [("foo", 3)]),
            (2.00, 2.25, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 3,
                "precision": 2,
                "min": 1.25,
                "max": 2.00,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (1.25, 1.50, [(f"{alias}.foo", 0)]),
                (1.50, 1.75, [(f"{alias}.foo", 0)]),
                (1.75, 2.00, [(f"{alias}.foo", 0)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_increased_precision_large_buckets(self):
        # range is [10.0000, 59.9999] so it is divided into 5 buckets of width 10
        specs = [
            (10.0000, 10.0000, [("foo", 1)]),
            (30.0000, 40.0000, [("foo", 1)]),
            (59.9999, 59.9999, [("foo", 2)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
                "precision": 4,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (10.0000, 20.0000, [(f"{alias}.foo", 1)]),
                (20.0000, 30.0000, [(f"{alias}.foo", 0)]),
                (30.0000, 40.0000, [(f"{alias}.foo", 1)]),
                (40.0000, 50.0000, [(f"{alias}.foo", 0)]),
                (50.0000, 60.0000, [(f"{alias}.foo", 2)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_multiple_measures(self):
        # range is [10, 59] so it is divided into 5 buckets of width 10
        specs = [
            (10, 10, [("bar", 0), ("baz", 0), ("foo", 1)]),
            (30, 40, [("bar", 2), ("baz", 0), ("foo", 0)]),
            (59, 59, [("bar", 0), ("baz", 1), ("foo", 0)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.bar", f"{alias}.baz", f"{alias}.foo"],
                "numBuckets": 5,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (
                    10,
                    20,
                    [
                        (f"{alias}.bar", 0),
                        (f"{alias}.baz", 0),
                        (f"{alias}.foo", 1),
                    ],
                ),
                (
                    20,
                    30,
                    [
                        (f"{alias}.bar", 0),
                        (f"{alias}.baz", 0),
                        (f"{alias}.foo", 0),
                    ],
                ),
                (
                    30,
                    40,
                    [
                        (f"{alias}.bar", 2),
                        (f"{alias}.baz", 0),
                        (f"{alias}.foo", 0),
                    ],
                ),
                (
                    40,
                    50,
                    [
                        (f"{alias}.bar", 0),
                        (f"{alias}.baz", 0),
                        (f"{alias}.foo", 0),
                    ],
                ),
                (
                    50,
                    60,
                    [
                        (f"{alias}.bar", 0),
                        (f"{alias}.baz", 1),
                        (f"{alias}.foo", 0),
                    ],
                ),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_max_value_on_edge(self):
        # range is [11, 21] so it is divided into 5 buckets of width 5
        # because using buckets of width 2 will exclude 21, and the next
        # nice number is 5
        specs = [
            (11, 11, [("bar", 0), ("baz", 0), ("foo", 1)]),
            (21, 21, [("bar", 1), ("baz", 1), ("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.bar", f"{alias}.baz", f"{alias}.foo"],
                "numBuckets": 5,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (
                    10,
                    15,
                    [
                        (f"{alias}.bar", 0),
                        (f"{alias}.baz", 0),
                        (f"{alias}.foo", 1),
                    ],
                ),
                (
                    15,
                    20,
                    [
                        (f"{alias}.bar", 0),
                        (f"{alias}.baz", 0),
                        (f"{alias}.foo", 0),
                    ],
                ),
                (
                    20,
                    25,
                    [
                        (f"{alias}.bar", 1),
                        (f"{alias}.baz", 1),
                        (f"{alias}.foo", 1),
                    ],
                ),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_bins_exceed_max(self):
        specs = [
            (10, 15, [("bar", 0), ("baz", 0), ("foo", 1)]),
            (30, 30, [("bar", 1), ("baz", 1), ("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.bar", f"{alias}.baz", f"{alias}.foo"],
                "numBuckets": 5,
                "min": 10,
                "max": 21,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (
                    10,
                    15,
                    [
                        (f"{alias}.bar", 0),
                        (f"{alias}.baz", 0),
                        (f"{alias}.foo", 1),
                    ],
                ),
                (
                    15,
                    20,
                    [
                        (f"{alias}.bar", 0),
                        (f"{alias}.baz", 0),
                        (f"{alias}.foo", 0),
                    ],
                ),
                (
                    20,
                    25,
                    [
                        (f"{alias}.bar", 0),
                        (f"{alias}.baz", 0),
                        (f"{alias}.foo", 0),
                    ],
                ),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_bad_params_invalid_data_filter(self):
        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo", f"{alias}.bar"],
                "numBuckets": 10,
                "dataFilter": "invalid",
            }

            response = self.do_request(query)
            assert response.status_code == 400, f"failing for {array_column}"
            assert response.data == {
                "dataFilter": ['"invalid" is not a valid choice.'],
            }, f"failing for {array_column}"

    def test_histogram_all_data_filter(self):
        specs = [
            (0, 1, [("foo", 4)]),
            (4000, 5000, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
                "dataFilter": "all",
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (0, 1000, [(f"{alias}.foo", 4)]),
                (1000, 2000, [(f"{alias}.foo", 0)]),
                (2000, 3000, [(f"{alias}.foo", 0)]),
                (3000, 4000, [(f"{alias}.foo", 0)]),
                (4000, 5000, [(f"{alias}.foo", 1)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_exclude_outliers_data_filter(self):
        specs = [
            (0, 0, [("foo", 4)]),
            (4000, 4001, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
                "dataFilter": "exclude_outliers",
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (0, 1, [(f"{alias}.foo", 4)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_missing_measurement_data(self):
        # make sure there is at least one transaction
        specs = [
            (0, 1, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                # make sure to query a measurement that does not exist
                "field": [f"{alias}.bar"],
                "numBuckets": 5,
                "dataFilter": "exclude_outliers",
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (0, 1, [(f"{alias}.bar", 0)]),
                (1, 1, [(f"{alias}.bar", 0)]),
                (2, 2, [(f"{alias}.bar", 0)]),
                (3, 3, [(f"{alias}.bar", 0)]),
                (4, 4, [(f"{alias}.bar", 0)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_missing_measurement_data_with_explicit_bounds(self):
        # make sure there is at least one transaction
        specs = [
            (0, 1, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                # make sure to query a measurement that does not exist
                "field": [f"{alias}.bar"],
                "numBuckets": 5,
                "dataFilter": "exclude_outliers",
                "min": 10,
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (10, 11, [(f"{alias}.bar", 0)]),
                (11, 11, [(f"{alias}.bar", 0)]),
                (12, 12, [(f"{alias}.bar", 0)]),
                (13, 13, [(f"{alias}.bar", 0)]),
                (14, 14, [(f"{alias}.bar", 0)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_ignores_aggregate_conditions(self):
        # range is [0, 5), so it is divided into 5 buckets of width 1
        specs = [
            (0, 1, [("foo", 1)]),
            (1, 2, [("foo", 1)]),
            (2, 3, [("foo", 1)]),
            (3, 4, [("foo", 0)]),
            (4, 5, [("foo", 1)]),
        ]
        self.populate_events(specs)

        for array_column in ARRAY_COLUMNS:
            alias = get_array_column_alias(array_column)
            query = {
                "project": [self.project.id],
                "field": [f"{alias}.foo"],
                "numBuckets": 5,
                "query": "tpm():>0.001",
            }

            response = self.do_request(query)
            assert response.status_code == 200, f"failing for {array_column}"
            expected = [
                (0, 1, [(f"{alias}.foo", 1)]),
                (1, 2, [(f"{alias}.foo", 1)]),
                (2, 3, [(f"{alias}.foo", 1)]),
                (3, 4, [(f"{alias}.foo", 0)]),
                (4, 5, [(f"{alias}.foo", 1)]),
            ]
            assert response.data == self.as_response_data(expected), f"failing for {array_column}"

    def test_histogram_outlier_filtering_with_no_rows(self):
        query = {
            "project": [self.project.id],
            "field": ["transaction.duration"],
            "numBuckets": 5,
            "dataFilter": "exclude_outliers",
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (0, 1, [("transaction.duration", 0)]),
        ]
        assert response.data == self.as_response_data(expected)


class OrganizationEventsMetricsEnhancedPerformanceHistogramEndpointTest(
    MetricsEnhancedPerformanceTestCase
):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.features = {}

    def populate_events(self, specs):
        start = before_now(minutes=5)
        for spec in specs:
            spec = HistogramSpec(*spec)
            for suffix_key, count in spec.fields:
                for i in range(count):
                    self.store_transaction_metric(
                        (spec.end + spec.start) / 2,
                        metric=suffix_key,
                        tags={"transaction": suffix_key, **spec.tags},
                        timestamp=start,
                        aggregation_option=AggregationOption.HIST,
                    )

    def as_response_data(self, specs):
        data: dict[str, list[dict[str, int]]] = {}
        for spec in specs:
            spec = HistogramSpec(*spec)
            for measurement, count in sorted(spec.fields):
                if measurement not in data:
                    data[measurement] = []
                data[measurement].append({"bin": spec.start, "count": count})
        return data

    def do_request(self, query, features=None):
        if features is None:
            features = {
                "organizations:performance-view": True,
                "organizations:performance-use-metrics": True,
            }
        features.update(self.features)
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-events-histogram",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        with self.feature(features):
            return self.client.get(url, query, format="json")

    def test_no_projects(self):
        response = self.do_request({})

        assert response.status_code == 200, response.content
        assert response.data == {}

    def test_histogram_simple(self):
        specs = [
            (0, 1, [("transaction.duration", 5)]),
            (1, 2, [("transaction.duration", 10)]),
            (2, 3, [("transaction.duration", 1)]),
            (4, 5, [("transaction.duration", 15)]),
        ]
        self.populate_events(specs)
        query = {
            "project": [self.project.id],
            "field": ["transaction.duration"],
            "numBuckets": 5,
            "dataset": "metrics",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        expected = [
            (0, 1, [("transaction.duration", 6)]),
            (1, 2, [("transaction.duration", 9)]),
            (2, 3, [("transaction.duration", 3)]),
            (3, 4, [("transaction.duration", 8)]),
            (4, 5, [("transaction.duration", 7)]),
        ]
        # Note metrics data is approximate, these values are based on running the test and asserting the results
        expected_response = self.as_response_data(expected)
        expected_response["meta"] = {"isMetricsData": True}
        assert response.data == expected_response

    def test_multi_histogram(self):
        specs = [
            (0, 1, [("measurements.fcp", 5), ("measurements.lcp", 5)]),
            (1, 2, [("measurements.fcp", 5), ("measurements.lcp", 5)]),
        ]
        self.populate_events(specs)
        query = {
            "project": [self.project.id],
            "field": ["measurements.fcp", "measurements.lcp"],
            "numBuckets": 2,
            "dataset": "metrics",
        }
        response = self.do_request(query)
        assert response.status_code == 200, response.content
        expected = [
            (0, 1, [("measurements.fcp", 5), ("measurements.lcp", 5)]),
            (1, 2, [("measurements.fcp", 5), ("measurements.lcp", 5)]),
        ]
        # Note metrics data is approximate, these values are based on running the test and asserting the results
        expected_response = self.as_response_data(expected)
        expected_response["meta"] = {"isMetricsData": True}
        assert response.data == expected_response

    def test_histogram_exclude_outliers_data_filter(self):
        specs = [
            (0, 0, [("transaction.duration", 4)], {"histogram_outlier": "inlier"}),
            (1, 1, [("transaction.duration", 4)], {"histogram_outlier": "inlier"}),
            (4000, 4001, [("transaction.duration", 1)], {"histogram_outlier": "outlier"}),
        ]
        self.populate_events(specs)

        query = {
            "project": [self.project.id],
            "field": ["transaction.duration"],
            "numBuckets": 5,
            "dataFilter": "exclude_outliers",
            "dataset": "metrics",
        }

        response = self.do_request(query)
        assert response.status_code == 200, response.content
        # Metrics approximation means both buckets got merged
        expected = [
            (0, 0, [("transaction.duration", 8)]),
            (1, 2, [("transaction.duration", 0)]),
        ]
        expected_response = self.as_response_data(expected)
        expected_response["meta"] = {"isMetricsData": True}
        assert response.data == expected_response


class OrganizationEventsMetricsEnhancedPerformanceHistogramEndpointTestWithMetricLayer(
    OrganizationEventsMetricsEnhancedPerformanceHistogramEndpointTest
):
    def setUp(self):
        super().setUp()
        self.features["organizations:use-metrics-layer"] = True
