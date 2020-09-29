from __future__ import absolute_import

import pytest
import random

from collections import namedtuple
from copy import deepcopy
from datetime import timedelta

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format

from sentry.utils.samples import load_data


HistogramSpec = namedtuple("HistogramSpec", ["start", "end", "measurements"])


class OrganizationEventsMeasurementsHistogramEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsMeasurementsHistogramEndpointTest, self).setUp()
        self.min_ago = iso_format(before_now(minutes=1))
        self.data = load_data("transaction")

    def populate_measurements(self, specs):
        start = before_now(minutes=5)
        for spec in specs:
            spec = HistogramSpec(*spec)
            for measurement, count in spec.measurements:
                for i in range(count):
                    data = deepcopy(self.data)

                    data["timestamp"] = iso_format(start)
                    data["start_timestamp"] = iso_format(start - timedelta(seconds=i))
                    value = random.random() * (spec.end - spec.start) + spec.start
                    data["transaction"] = "/measurement/{}/value/{}".format(measurement, value)

                    data["measurements"] = {measurement: {"value": value}}
                    self.store_event(data, self.project.id)

    def as_response_data(self, specs):
        data = []
        for spec in specs:
            spec = HistogramSpec(*spec)
            for measurement, count in sorted(spec.measurements):
                data.append({"key": measurement, "bin": spec.start, "count": count})
        return data

    def do_request(self, query, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-events-measurements-histogram",
            kwargs={"organization_slug": self.organization.slug},
        )
        with self.feature(features):
            return self.client.get(url, query, format="json")

    def test_no_projects(self):
        response = self.do_request({})

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_good_params(self):
        query = {
            "project": [self.project.id],
            "measurement": ["foo", "bar"],
            "num_buckets": 10,
        }

        response = self.do_request(query)
        assert response.status_code == 200

    def test_good_params_with_optionals(self):
        query = {
            "project": [self.project.id],
            "measurement": ["foo", "bar"],
            "num_buckets": 10,
            "min": 0,
            "max": 100,
            "precision": 0,
        }

        response = self.do_request(query)
        assert response.status_code == 200

    def test_bad_params_missing_measurement(self):
        query = {
            "project": [self.project.id],
            "num_buckets": 10,
        }

        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "measurement": ["This list may not be empty."],
        }

    def test_bad_params_too_many_measurements(self):
        query = {
            "project": [self.project.id],
            "measurement": ["foo", "bar", "baz", "qux", "quux"],
            "num_buckets": 10,
            "min": 0,
            "max": 100,
            "precision": 0,
        }

        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "measurement": ["Ensure this field has no more than 4 elements."],
        }

    def test_bad_params_missing_num_buckets(self):
        query = {
            "project": [self.project.id],
            "measurement": ["foo", "bar"],
        }
        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "num_buckets": ["This field is required."],
        }

    def test_bad_params_invalid_num_buckets(self):
        query = {
            "project": [self.project.id],
            "measurement": ["foo", "bar"],
            "num_buckets": "baz",
        }
        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "num_buckets": ["A valid integer is required."],
        }

    def test_bad_params_invalid_negative_num_buckets(self):
        query = {
            "project": [self.project.id],
            "measurement": ["foo", "bar"],
            "num_buckets": -1,
        }
        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "num_buckets": ["Ensure this value is greater than or equal to 1."],
        }

    def test_bad_params_invalid_precision_too_small(self):
        query = {
            "project": [self.project.id],
            "measurement": ["foo", "bar"],
            "num_buckets": 10,
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
            "measurement": ["foo", "bar"],
            "num_buckets": 10,
            "precision": 100,
        }

        response = self.do_request(query)
        assert response.status_code == 400
        assert response.data == {
            "precision": ["Ensure this value is less than or equal to 4."],
        }

    def test_histogram_empty(self):
        specs = [(i, i + 1, [("foo", 0), ("bar", 0)]) for i in range(5)]

        query = {
            "project": [self.project.id],
            "measurement": ["foo", "bar"],
            "num_buckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert response.data["data"] == self.as_response_data(specs)

    def test_histogram_simple(self):
        # range is [0, 5), so it is divided into 5 buckets of width 1
        specs = [
            (0, 1, [("foo", 1)]),
            (1, 2, [("foo", 1)]),
            (2, 3, [("foo", 1)]),
            (3, 4, [("foo", 0)]),
            (4, 5, [("foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "measurement": ["foo"],
            "num_buckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert response.data["data"] == self.as_response_data(specs)

    def test_histogram_large_buckets(self):
        # make sure that it works for large width buckets
        # range is [0, 99], so it is divided into 5 buckets of width 20
        specs = [
            (0, 0, [("foo", 2)]),
            (20, 40, [("foo", 0)]),
            (40, 60, [("foo", 0)]),
            (60, 80, [("foo", 0)]),
            (99, 99, [("foo", 2)]),
        ]
        self.populate_measurements(specs)
        specs[0] = (0, 20, specs[0][2])
        specs[4] = (80, 100, specs[4][2])

        query = {
            "project": [self.project.id],
            "measurement": ["foo"],
            "num_buckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert response.data["data"] == self.as_response_data(specs)

    def test_histogram_non_zero_min(self):
        # range is [10, 15), so it is divided into 5 buckets of width 1
        specs = [
            (10, 11, [("foo", 1)]),
            (11, 12, [("foo", 0)]),
            (12, 13, [("foo", 1)]),
            (13, 14, [("foo", 1)]),
            (14, 15, [("foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "measurement": ["foo"],
            "num_buckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert response.data["data"] == self.as_response_data(specs)

    def test_histogram_non_zero_min_large_buckets(self):
        # range is [10, 59], so it is divided into 5 buckets of width 10
        specs = [
            (10, 10, [("foo", 1)]),
            (20, 30, [("foo", 0)]),
            (30, 40, [("foo", 0)]),
            (40, 50, [("foo", 1)]),
            (59, 59, [("foo", 2)]),
        ]
        self.populate_measurements(specs)
        specs[0] = (10, 20, specs[0][2])
        specs[4] = (50, 60, specs[4][2])

        query = {
            "project": [self.project.id],
            "measurement": ["foo"],
            "num_buckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert response.data["data"] == self.as_response_data(specs)

    @pytest.mark.xfail(reason="snuba does not allow - in alias names")
    def test_histogram_negative_values(self):
        # range is [-9, -4), so it is divided into 5 buckets of width 1
        specs = [
            (-9, -8, [("foo", 3)]),
            (-8, -7, [("foo", 0)]),
            (-7, -6, [("foo", 0)]),
            (-6, -5, [("foo", 0)]),
            (-5, -4, [("foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "measurement": ["foo"],
            "num_buckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert response.data["data"] == self.as_response_data(specs)

    @pytest.mark.xfail(reason="snuba does not allow - in alias names")
    def test_histogram_positive_and_negative_values(self):
        # range is [-50, 49], so it is divided into 5 buckets of width 10
        specs = [
            (-50, -50, [("foo", 1)]),
            (-30, -10, [("foo", 0)]),
            (-10, 10, [("foo", 2)]),
            (10, 30, [("foo", 0)]),
            (49, 49, [("foo", 1)]),
        ]
        self.populate_measurements(specs)
        specs[0] = (-50, -30, specs[0][2])
        specs[4] = (30, 50, specs[4][2])

        query = {
            "project": [self.project.id],
            "measurement": ["foo"],
            "num_buckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert response.data["data"] == self.as_response_data(specs)

    def test_histogram_increased_precision(self):
        # range is [1.00, 2.24], so it is divided into 5 buckets of width 0.25
        specs = [
            (1.00, 1.00, [("foo", 3)]),
            (1.25, 1.50, [("foo", 0)]),
            (1.50, 1.75, [("foo", 0)]),
            (1.75, 2.00, [("foo", 0)]),
            (2.24, 2.24, [("foo", 1)]),
        ]
        self.populate_measurements(specs)
        specs[0] = (1.00, 1.25, specs[0][2])
        specs[4] = (2.00, 2.25, specs[4][2])

        query = {
            "project": [self.project.id],
            "measurement": ["foo"],
            "num_buckets": 5,
            "precision": 2,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert response.data["data"] == self.as_response_data(specs)

    def test_histogram_increased_precision_large_buckets(self):
        # range is [10.0000, 59.9999] so it is divided into 5 buckets of width 10
        specs = [
            (10.0000, 10.0000, [("foo", 1)]),
            (20.0000, 30.0000, [("foo", 0)]),
            (30.0000, 40.0000, [("foo", 1)]),
            (40.0000, 50.0000, [("foo", 0)]),
            (59.9999, 59.9999, [("foo", 2)]),
        ]
        self.populate_measurements(specs)
        specs[0] = (10.0000, 20.0000, specs[0][2])
        specs[4] = (50.0000, 60.0000, specs[4][2])

        query = {
            "project": [self.project.id],
            "measurement": ["foo"],
            "num_buckets": 5,
            "precision": 4,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert response.data["data"] == self.as_response_data(specs)

    def test_histogram_multiple_measures(self):
        # range is [10, 59] so it is divided into 5 buckets of width 10
        specs = [
            (10, 10, [("bar", 0), ("baz", 0), ("foo", 1)]),
            (20, 30, [("bar", 0), ("baz", 0), ("foo", 0)]),
            (30, 40, [("bar", 2), ("baz", 0), ("foo", 0)]),
            (40, 50, [("bar", 0), ("baz", 0), ("foo", 0)]),
            (59, 59, [("bar", 0), ("baz", 1), ("foo", 0)]),
        ]
        self.populate_measurements(specs)
        specs[0] = (10, 20, specs[0][2])
        specs[4] = (50, 60, specs[4][2])

        query = {
            "project": [self.project.id],
            "measurement": ["bar", "baz", "foo"],
            "num_buckets": 5,
        }

        response = self.do_request(query)
        assert response.status_code == 200
        assert response.data["data"] == self.as_response_data(specs)

    def test_histogram_max_value_on_edge(self):
        # range is [11, 21] so it is divided into 5 buckets of width 3
        # because using buckets of width 2 will exclude 21
        specs = [
            (11, 11, [("bar", 0), ("baz", 0), ("foo", 1)]),
            (13, 15, [("bar", 0), ("baz", 0), ("foo", 0)]),
            (15, 17, [("bar", 0), ("baz", 0), ("foo", 0)]),
            (17, 19, [("bar", 0), ("baz", 0), ("foo", 0)]),
            (21, 21, [("bar", 1), ("baz", 1), ("foo", 1)]),
        ]
        self.populate_measurements(specs)

        query = {
            "project": [self.project.id],
            "measurement": ["bar", "baz", "foo"],
            "num_buckets": 5,
        }

        specs = [
            (11, 14, [("bar", 0), ("baz", 0), ("foo", 1)]),
            (14, 17, [("bar", 0), ("baz", 0), ("foo", 0)]),
            (17, 20, [("bar", 0), ("baz", 0), ("foo", 0)]),
            (20, 23, [("bar", 1), ("baz", 1), ("foo", 1)]),
            (23, 26, [("bar", 0), ("baz", 0), ("foo", 0)]),
        ]
        response = self.do_request(query)
        assert response.status_code == 200
        assert response.data["data"] == self.as_response_data(specs)
