import pytest
import random

from collections import namedtuple
from copy import deepcopy
from datetime import timedelta

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format

from sentry.utils.samples import load_data
from sentry.utils.snuba import is_measurement, get_measurement_name


HistogramSpec = namedtuple("HistogramSpec", ["start", "end", "fields"])


class OrganizationEventsHistogramEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsHistogramEndpointTest, self).setUp()
        self.min_ago = iso_format(before_now(minutes=1))
        self.data = load_data("transaction")

    def populate_measurements(self, specs):
        start = before_now(minutes=5)
        for spec in specs:
            spec = HistogramSpec(*spec)
            for field, count in spec.fields:
                if not is_measurement(field):
                    continue

                measurement = get_measurement_name(field)
                for i in range(count):
                    data = deepcopy(self.data)

                    data["timestamp"] = iso_format(start)
                    data["start_timestamp"] = iso_format(start - timedelta(seconds=i))
                    value = random.random() * (spec.end - spec.start) + spec.start
                    data["transaction"] = "/measurement/{}/value/{}".format(measurement, value)

                    data["measurements"] = {measurement: {"value": value}}
                    self.store_event(data, self.project.id)

    def as_response_data(self, specs):
        data = {}
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
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-events-histogram",
            kwargs={"organization_slug": self.organization.slug},
        )
        with self.feature(features):
            return self.client.get(url, query, format="json")

    def test_no_projects(self):
        response = self.do_request({})

        assert response.status_code == 200, response.content
        assert response.data == {}

    def test_good_params(self):
        query = {
            "query": "event.type:transaction",
            "project": [self.project.id],
            "field": ["measurements.foo", "measurements.bar"],
            "numBuckets": 10,
        }

        response = self.do_request(query)
        assert response.status_code == 200

    def test_good_params_with_optionals(self):
        query = {
            "query": "event.type:transaction",
            "project": [self.project.id],
            "field": ["measurements.foo", "measurements.bar"],
            "numBuckets": 10,
            "precision": 0,
            "min": 0,
            "max": 10,
        }

        response = self.do_request(query)
        assert response.status_code == 200

    def test_bad_params_missing_fields(self):
        query = {
            "project": [self.project.id],
            "numBuckets": 10,
        }

        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "field": ["This list may not be empty."],
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
        query = {
            "project": [self.project.id],
            "field": ["foo", "measurements.bar"],
            "numBuckets": 10,
            "min": 0,
            "max": 100,
            "precision": 0,
        }

        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "field": [
                "You can only generate histogram for one column at a time unless they are all measurements."
            ],
        }

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
        query = {
            "project": [self.project.id],
            "field": ["measurements.foo", "measurements.bar"],
            "numBuckets": "baz",
        }
        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "numBuckets": ["A valid integer is required."],
        }

    def test_bad_params_invalid_negative_num_buckets(self):
        query = {
            "project": [self.project.id],
            "field": ["measurements.foo", "measurements.bar"],
            "numBuckets": -1,
        }
        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "numBuckets": ["Ensure this value is greater than or equal to 1."],
        }

    def test_bad_params_num_buckets_too_large(self):
        query = {
            "project": [self.project.id],
            "field": ["measurements.foo", "measurements.bar"],
            "numBuckets": 150,
        }
        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "numBuckets": ["Ensure this value is less than or equal to 100."],
        }

    def test_bad_params_invalid_precision_too_small(self):
        query = {
            "project": [self.project.id],
            "field": ["measurements.foo", "measurements.bar"],
            "numBuckets": 10,
            "precision": -1,
        }

        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "precision": ["Ensure this value is greater than or equal to 0."],
        }

    def test_bad_params_invalid_precision_too_big(self):
        query = {
            "project": [self.project.id],
            "field": ["measurements.foo", "measurements.bar"],
            "numBuckets": 10,
            "precision": 100,
        }

        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "precision": ["Ensure this value is less than or equal to 4."],
        }

    def test_bad_params_invalid_min(self):
        query = {
            "project": [self.project.id],
            "field": ["measurements.foo", "measurements.bar"],
            "numBuckets": 10,
            "min": "qux",
        }

        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "min": ["A valid number is required."],
        }

    def test_bad_params_invalid_max(self):
        query = {
            "project": [self.project.id],
            "field": ["measurements.foo", "measurements.bar"],
            "numBuckets": 10,
            "max": "qux",
        }

        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "max": ["A valid number is required."],
        }

    def test_histogram_empty(self):
        query = {
            "project": [self.project.id],
            "field": ["measurements.foo", "measurements.bar"],
            "numBuckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (i, i + 1, [("measurements.foo", 0), ("measurements.bar", 0)]) for i in range(5)
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_simple(self):
        # range is [0, 5), so it is divided into 5 buckets of width 1
        specs = [
            (0, 1, [("measurements.foo", 1)]),
            (1, 2, [("measurements.foo", 1)]),
            (2, 3, [("measurements.foo", 1)]),
            (4, 5, [("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.foo"],
            "numBuckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (0, 1, [("measurements.foo", 1)]),
            (1, 2, [("measurements.foo", 1)]),
            (2, 3, [("measurements.foo", 1)]),
            (3, 4, [("measurements.foo", 0)]),
            (4, 5, [("measurements.foo", 1)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_simple_using_min_max(self):
        # range is [0, 5), so it is divided into 5 buckets of width 1
        specs = [
            (0, 1, [("measurements.foo", 1)]),
            (1, 2, [("measurements.foo", 1)]),
            (2, 3, [("measurements.foo", 1)]),
            (4, 5, [("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.foo"],
            "numBuckets": 5,
            "min": 0,
            "max": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (0, 1, [("measurements.foo", 1)]),
            (1, 2, [("measurements.foo", 1)]),
            (2, 3, [("measurements.foo", 1)]),
            (3, 4, [("measurements.foo", 0)]),
            (4, 5, [("measurements.foo", 1)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_large_buckets(self):
        # make sure that it works for large width buckets
        # range is [0, 99], so it is divided into 5 buckets of width 20
        specs = [
            (0, 0, [("measurements.foo", 2)]),
            (99, 99, [("measurements.foo", 2)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.foo"],
            "numBuckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (0, 20, [("measurements.foo", 2)]),
            (20, 40, [("measurements.foo", 0)]),
            (40, 60, [("measurements.foo", 0)]),
            (60, 80, [("measurements.foo", 0)]),
            (80, 100, [("measurements.foo", 2)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_non_zero_offset(self):
        # range is [10, 15), so it is divided into 5 buckets of width 1
        specs = [
            (10, 11, [("measurements.foo", 1)]),
            (12, 13, [("measurements.foo", 1)]),
            (13, 14, [("measurements.foo", 1)]),
            (14, 15, [("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.foo"],
            "numBuckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (10, 11, [("measurements.foo", 1)]),
            (11, 12, [("measurements.foo", 0)]),
            (12, 13, [("measurements.foo", 1)]),
            (13, 14, [("measurements.foo", 1)]),
            (14, 15, [("measurements.foo", 1)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_extra_data(self):
        # range is [11, 16), so it is divided into 5 buckets of width 1
        # make sure every bin has some value
        specs = [
            (10, 11, [("measurements.foo", 1)]),
            (11, 12, [("measurements.foo", 1)]),
            (12, 13, [("measurements.foo", 1)]),
            (13, 14, [("measurements.foo", 1)]),
            (14, 15, [("measurements.foo", 1)]),
            (15, 16, [("measurements.foo", 1)]),
            (16, 17, [("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.foo"],
            "numBuckets": 5,
            "min": 11,
            "max": 16,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (11, 12, [("measurements.foo", 1)]),
            (12, 13, [("measurements.foo", 1)]),
            (13, 14, [("measurements.foo", 1)]),
            (14, 15, [("measurements.foo", 1)]),
            (15, 16, [("measurements.foo", 1)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_non_zero_min_large_buckets(self):
        # range is [10, 59], so it is divided into 5 buckets of width 10
        specs = [
            (10, 10, [("measurements.foo", 1)]),
            (40, 50, [("measurements.foo", 1)]),
            (59, 59, [("measurements.foo", 2)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.foo"],
            "numBuckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (10, 20, [("measurements.foo", 1)]),
            (20, 30, [("measurements.foo", 0)]),
            (30, 40, [("measurements.foo", 0)]),
            (40, 50, [("measurements.foo", 1)]),
            (50, 60, [("measurements.foo", 2)]),
        ]
        assert response.data == self.as_response_data(expected)

    @pytest.mark.xfail(reason="snuba does not allow - in alias names")
    def test_histogram_negative_values(self):
        # range is [-9, -4), so it is divided into 5 buckets of width 1
        specs = [
            (-9, -8, [("measurements.foo", 3)]),
            (-5, -4, [("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.foo"],
            "numBuckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (-9, -8, [("measurements.foo", 3)]),
            (-8, -7, [("measurements.foo", 0)]),
            (-7, -6, [("measurements.foo", 0)]),
            (-6, -5, [("measurements.foo", 0)]),
            (-5, -4, [("measurements.foo", 1)]),
        ]
        assert response.data == self.as_response_data(expected)

    @pytest.mark.xfail(reason="snuba does not allow - in alias names")
    def test_histogram_positive_and_negative_values(self):
        # range is [-50, 49], so it is divided into 5 buckets of width 10
        specs = [
            (-50, -50, [("measurements.foo", 1)]),
            (-10, 10, [("measurements.foo", 2)]),
            (49, 49, [("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.foo"],
            "numBuckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (-50, -30, [("measurements.foo", 1)]),
            (-30, -10, [("measurements.foo", 0)]),
            (-10, 10, [("measurements.foo", 2)]),
            (10, 30, [("measurements.foo", 0)]),
            (30, 50, [("measurements.foo", 1)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_increased_precision(self):
        # range is [1.00, 2.24], so it is divided into 5 buckets of width 0.25
        specs = [
            (1.00, 1.00, [("measurements.foo", 3)]),
            (2.24, 2.24, [("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.foo"],
            "numBuckets": 5,
            "precision": 2,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (1.00, 1.25, [("measurements.foo", 3)]),
            (1.25, 1.50, [("measurements.foo", 0)]),
            (1.50, 1.75, [("measurements.foo", 0)]),
            (1.75, 2.00, [("measurements.foo", 0)]),
            (2.00, 2.25, [("measurements.foo", 1)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_increased_precision_with_min_max(self):
        # range is [1.25, 2.24], so it is divided into 5 buckets of width 0.25
        specs = [
            (1.00, 1.25, [("measurements.foo", 3)]),
            (2.00, 2.25, [("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.foo"],
            "numBuckets": 3,
            "precision": 2,
            "min": 1.25,
            "max": 2.00,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (1.25, 1.50, [("measurements.foo", 0)]),
            (1.50, 1.75, [("measurements.foo", 0)]),
            (1.75, 2.00, [("measurements.foo", 0)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_increased_precision_large_buckets(self):
        # range is [10.0000, 59.9999] so it is divided into 5 buckets of width 10
        specs = [
            (10.0000, 10.0000, [("measurements.foo", 1)]),
            (30.0000, 40.0000, [("measurements.foo", 1)]),
            (59.9999, 59.9999, [("measurements.foo", 2)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.foo"],
            "numBuckets": 5,
            "precision": 4,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (10.0000, 20.0000, [("measurements.foo", 1)]),
            (20.0000, 30.0000, [("measurements.foo", 0)]),
            (30.0000, 40.0000, [("measurements.foo", 1)]),
            (40.0000, 50.0000, [("measurements.foo", 0)]),
            (50.0000, 60.0000, [("measurements.foo", 2)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_multiple_measures(self):
        # range is [10, 59] so it is divided into 5 buckets of width 10
        specs = [
            (10, 10, [("measurements.bar", 0), ("measurements.baz", 0), ("measurements.foo", 1)]),
            (30, 40, [("measurements.bar", 2), ("measurements.baz", 0), ("measurements.foo", 0)]),
            (59, 59, [("measurements.bar", 0), ("measurements.baz", 1), ("measurements.foo", 0)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.bar", "measurements.baz", "measurements.foo"],
            "numBuckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (10, 20, [("measurements.bar", 0), ("measurements.baz", 0), ("measurements.foo", 1)]),
            (20, 30, [("measurements.bar", 0), ("measurements.baz", 0), ("measurements.foo", 0)]),
            (30, 40, [("measurements.bar", 2), ("measurements.baz", 0), ("measurements.foo", 0)]),
            (40, 50, [("measurements.bar", 0), ("measurements.baz", 0), ("measurements.foo", 0)]),
            (50, 60, [("measurements.bar", 0), ("measurements.baz", 1), ("measurements.foo", 0)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_max_value_on_edge(self):
        # range is [11, 21] so it is divided into 5 buckets of width 5
        # because using buckets of width 2 will exclude 21, and the next
        # nice number is 5
        specs = [
            (11, 11, [("measurements.bar", 0), ("measurements.baz", 0), ("measurements.foo", 1)]),
            (21, 21, [("measurements.bar", 1), ("measurements.baz", 1), ("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.bar", "measurements.baz", "measurements.foo"],
            "numBuckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (10, 15, [("measurements.bar", 0), ("measurements.baz", 0), ("measurements.foo", 1)]),
            (15, 20, [("measurements.bar", 0), ("measurements.baz", 0), ("measurements.foo", 0)]),
            (20, 25, [("measurements.bar", 1), ("measurements.baz", 1), ("measurements.foo", 1)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_bins_exceed_max(self):
        specs = [
            (10, 15, [("measurements.bar", 0), ("measurements.baz", 0), ("measurements.foo", 1)]),
            (30, 30, [("measurements.bar", 1), ("measurements.baz", 1), ("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.bar", "measurements.baz", "measurements.foo"],
            "numBuckets": 5,
            "min": 10,
            "max": 21,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (10, 15, [("measurements.bar", 0), ("measurements.baz", 0), ("measurements.foo", 1)]),
            (15, 20, [("measurements.bar", 0), ("measurements.baz", 0), ("measurements.foo", 0)]),
            (20, 25, [("measurements.bar", 0), ("measurements.baz", 0), ("measurements.foo", 0)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_bad_params_invalid_data_filter(self):
        query = {
            "project": [self.project.id],
            "field": ["measurements.foo", "measurements.bar"],
            "numBuckets": 10,
            "dataFilter": "invalid",
        }

        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "dataFilter": ['"invalid" is not a valid choice.'],
        }

    def test_histogram_all_data_filter(self):
        specs = [
            (0, 1, [("measurements.foo", 4)]),
            (4000, 5000, [("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.foo"],
            "numBuckets": 5,
            "dataFilter": "all",
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (0, 1000, [("measurements.foo", 4)]),
            (1000, 2000, [("measurements.foo", 0)]),
            (2000, 3000, [("measurements.foo", 0)]),
            (3000, 4000, [("measurements.foo", 0)]),
            (4000, 5000, [("measurements.foo", 1)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_exclude_outliers_data_filter(self):
        specs = [
            (0, 0, [("measurements.foo", 4)]),
            (4000, 4001, [("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.foo"],
            "numBuckets": 5,
            "dataFilter": "exclude_outliers",
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (0, 1, [("measurements.foo", 4)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_missing_measurement_data(self):
        # make sure there is at least one transaction
        specs = [
            (0, 1, [("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            # make sure to query a measurement that does not exist
            "field": ["measurements.bar"],
            "numBuckets": 5,
            "dataFilter": "exclude_outliers",
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (0, 1, [("measurements.bar", 0)]),
            (1, 1, [("measurements.bar", 0)]),
            (2, 2, [("measurements.bar", 0)]),
            (3, 3, [("measurements.bar", 0)]),
            (4, 4, [("measurements.bar", 0)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_missing_measurement_data_with_explicit_bounds(self):
        # make sure there is at least one transaction
        specs = [
            (0, 1, [("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            # make sure to query a measurement that does not exist
            "field": ["measurements.bar"],
            "numBuckets": 5,
            "dataFilter": "exclude_outliers",
            "min": 10,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = [
            (10, 11, [("measurements.bar", 0)]),
            (11, 11, [("measurements.bar", 0)]),
            (12, 12, [("measurements.bar", 0)]),
            (13, 13, [("measurements.bar", 0)]),
            (14, 14, [("measurements.bar", 0)]),
        ]
        assert response.data == self.as_response_data(expected)

    def test_histogram_ignores_aggregate_conditions(self):
        # range is [0, 5), so it is divided into 5 buckets of width 1
        specs = [
            (0, 1, [("measurements.foo", 1)]),
            (1, 2, [("measurements.foo", 1)]),
            (2, 3, [("measurements.foo", 1)]),
            (3, 4, [("measurements.foo", 0)]),
            (4, 5, [("measurements.foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "field": ["measurements.foo"],
            "numBuckets": 5,
            "query": "tpm():>0.001",
        }

        response = self.do_request(query)
        assert response.status_code == 200
        expected = specs
        assert response.data == self.as_response_data(expected)

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
