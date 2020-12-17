from __future__ import absolute_import

from datetime import timedelta

from django.core.urlresolvers import reverse

from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils import APITestCase, SnubaTestCase

from sentry.utils.samples import load_data


class OrganizationEventsVitalsEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsVitalsEndpointTest, self).setUp()
        self.start = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.end = self.start + timedelta(hours=6)

        self.transaction_data = load_data("transaction", timestamp=self.start)
        self.query = {
            "start": iso_format(self.start),
            "end": iso_format(self.end),
        }

    def store_event(self, data, measurements=None, **kwargs):
        if measurements:
            for vital, value in measurements.items():
                data["measurements"][vital]["value"] = value

        return super(OrganizationEventsVitalsEndpointTest, self).store_event(
            data.copy(), project_id=self.project.id,
        )

    def do_request(self, query=None, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        if query is None:
            query = self.query

        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-events-vitals",
            kwargs={"organization_slug": self.organization.slug},
        )

        with self.feature(features):
            return self.client.get(url, query, format="json")

    def test_no_projects(self):
        response = self.do_request()
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_no_vitals(self):
        self.store_event(
            self.transaction_data, project_id=self.project.id,
        )

        self.query.update({"vital": []})
        response = self.do_request()
        assert response.status_code == 400, response.content
        assert "Need to pass at least one vital" == response.data["detail"]

    def test_bad_vital(self):
        self.store_event(
            self.transaction_data, project_id=self.project.id,
        )

        self.query.update({"vital": ["foobar"]})
        response = self.do_request()
        assert response.status_code == 400, response.content
        assert "foobar is not a valid vital" == response.data["detail"]

    def test_simple(self):
        data = self.transaction_data.copy()
        for lcp in [2000, 3000, 5000]:
            self.store_event(
                data, {"lcp": lcp}, project_id=self.project.id,
            )

        self.query.update({"vital": ["measurements.lcp"]})
        response = self.do_request()
        assert response.status_code == 200, response.content
        assert response.data["measurements.lcp"] == {
            "group_0": 1,
            "group_1": 1,
            "group_2": 1,
            "total": 3,
            "p75": 4000,
        }

    def test_grouping(self):
        counts = [
            (100, 2),
            (3000, 3),
            (4500, 1),
        ]
        for duration, count in counts:
            for _ in range(count):
                self.store_event(
                    load_data("transaction", timestamp=self.start),
                    {"lcp": duration},
                    project_id=self.project.id,
                )

        self.query.update({"vital": ["measurements.lcp"]})
        response = self.do_request()
        assert response.status_code == 200
        print(response.data)
        assert response.data["measurements.lcp"] == {
            "group_0": 2,
            "group_1": 3,
            "group_2": 1,
            "total": 6,
            "p75": 3000,
        }

    def test_multiple_vitals(self):
        vitals = {"lcp": 3000, "fcp": 5000}
        self.store_event(
            load_data("transaction", timestamp=self.start), vitals, project_id=self.project.id,
        )

        self.query.update({"vital": ["measurements.lcp", "measurements.fcp"]})
        response = self.do_request()
        assert response.status_code == 200
        assert response.data["measurements.lcp"] == {
            "group_0": 0,
            "group_1": 1,
            "group_2": 0,
            "total": 1,
            "p75": 3000,
        }
        assert response.data["measurements.fcp"] == {
            "group_0": 0,
            "group_1": 0,
            "group_2": 1,
            "total": 1,
            "p75": 5000,
        }

    def test_transactions_without_vitals(self):
        del self.transaction_data["measurements"]
        self.store_event(
            self.transaction_data, project_id=self.project.id,
        )

        self.query.update({"vital": ["measurements.lcp", "measurements.fcp"]})
        response = self.do_request()
        assert response.status_code == 200
        assert response.data["measurements.lcp"] == {
            "group_0": None,
            "group_1": None,
            "group_2": None,
            "total": 0,
            "p75": None,
        }
        assert response.data["measurements.fcp"] == {
            "group_0": None,
            "group_1": None,
            "group_2": None,
            "total": 0,
            "p75": None,
        }
