from datetime import timedelta

import pytest
from django.urls import reverse

from sentry.models.transaction_threshold import ProjectTransactionThreshold, TransactionMetric
from sentry.testutils.cases import APITestCase, MetricsEnhancedPerformanceTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data

pytestmark = pytest.mark.sentry_metrics


class OrganizationEventsVitalsEndpointTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.start = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.end = self.start + timedelta(hours=6)

        self.transaction_data = load_data("transaction", timestamp=self.start)
        self.query: dict[str, str | list[str]] = {
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
        }
        self.features = {}

    def store_event(self, data, measurements=None, **kwargs):
        if measurements:
            for vital, value in measurements.items():
                data["measurements"][vital]["value"] = value

        return super().store_event(
            data.copy(),
            project_id=self.project.id,
        )

    def do_request(self, query=None, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        if query is None:
            query = self.query

        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-events-vitals",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

        with self.feature(features):
            return self.client.get(url, query, format="json")

    def test_no_projects(self):
        response = self.do_request()
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_no_vitals(self):
        self.store_event(
            self.transaction_data,
            project_id=self.project.id,
        )

        self.query.update({"vital": []})
        response = self.do_request()
        assert response.status_code == 400, response.content
        assert "Need to pass at least one vital" == response.data["detail"]

    def test_bad_vital(self):
        self.store_event(
            self.transaction_data,
            project_id=self.project.id,
        )

        self.query.update({"vital": ["foobar"]})
        response = self.do_request()
        assert response.status_code == 400, response.content
        assert "foobar is not a valid vital" == response.data["detail"]

    def test_simple(self):
        data = self.transaction_data.copy()
        for lcp in [2000, 3000, 5000]:
            self.store_event(
                data,
                {"lcp": lcp},
                project_id=self.project.id,
            )

        self.query.update({"vital": ["measurements.lcp"]})
        response = self.do_request()
        assert response.status_code == 200, response.content
        assert not response.data["meta"]["isMetricsData"]
        assert response.data["measurements.lcp"] == {
            "good": 1,
            "meh": 1,
            "poor": 1,
            "total": 3,
            "p75": 4000,
        }

    def test_simple_with_refining_user_misery_filter(self):
        project1 = self.create_project(organization=self.organization)
        project2 = self.create_project(organization=self.organization)
        ProjectTransactionThreshold.objects.create(
            project=project1,
            organization=project1.organization,
            threshold=100,
            metric=TransactionMetric.LCP.value,
        )

        ProjectTransactionThreshold.objects.create(
            project=project2,
            organization=project2.organization,
            threshold=1000,
            metric=TransactionMetric.LCP.value,
        )

        data = self.transaction_data.copy()

        for project in [project1, project2]:
            for lcp in [2000, 3000, 5000]:
                self.store_event(
                    data,
                    {"lcp": lcp},
                    project_id=project.id,
                )

        self.query.update({"vital": ["measurements.lcp"]})
        response = self.do_request(
            features={"organizations:global-views": True, "organizations:discover-basic": True}
        )

        assert response.status_code == 200, response.content
        assert not response.data["meta"]["isMetricsData"]
        assert response.data["measurements.lcp"] == {
            "good": 0,
            "meh": 1,
            "poor": 1,
            "total": 2,
            "p75": 4500,
        }

        self.query.update({"query": "user_misery():<0.04"})
        response = self.do_request(
            features={"organizations:global-views": True, "organizations:discover-basic": True}
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert not response.data["meta"]["isMetricsData"]
        assert response.data["measurements.lcp"] == {
            "good": 0,
            "meh": 1,
            "poor": 1,
            "total": 2,
            "p75": 4500,
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
        assert not response.data["meta"]["isMetricsData"]
        assert response.data["measurements.lcp"] == {
            "good": 2,
            "meh": 3,
            "poor": 1,
            "total": 6,
            "p75": 3000,
        }

    def test_multiple_vitals(self):
        vitals = {"lcp": 3000, "fid": 50, "cls": 0.15, "fcp": 5000, "fp": 4000}
        self.store_event(
            load_data("transaction", timestamp=self.start),
            vitals,
            project_id=self.project.id,
        )

        self.query.update(
            {
                "vital": [
                    "measurements.lcp",
                    "measurements.fid",
                    "measurements.cls",
                    "measurements.fcp",
                    "measurements.fp",
                ]
            }
        )
        response = self.do_request()
        assert response.status_code == 200
        assert not response.data["meta"]["isMetricsData"]
        assert response.data["measurements.lcp"] == {
            "good": 0,
            "meh": 1,
            "poor": 0,
            "total": 1,
            "p75": 3000,
        }
        assert response.data["measurements.fid"] == {
            "good": 1,
            "meh": 0,
            "poor": 0,
            "total": 1,
            "p75": 50,
        }
        assert response.data["measurements.cls"] == {
            "good": 0,
            "meh": 1,
            "poor": 0,
            "total": 1,
            "p75": 0.15,
        }
        assert response.data["measurements.fcp"] == {
            "good": 0,
            "meh": 0,
            "poor": 1,
            "total": 1,
            "p75": 5000,
        }
        assert response.data["measurements.fp"] == {
            "good": 0,
            "meh": 0,
            "poor": 1,
            "total": 1,
            "p75": 4000,
        }

    def test_transactions_without_vitals(self):
        del self.transaction_data["measurements"]
        self.store_event(
            self.transaction_data,
            project_id=self.project.id,
        )

        self.query.update({"vital": ["measurements.lcp", "measurements.fcp"]})
        response = self.do_request()
        assert response.status_code == 200, response.data
        assert not response.data["meta"]["isMetricsData"]
        assert response.data["measurements.lcp"] == {
            "good": 0,
            "meh": 0,
            "poor": 0,
            "total": 0,
            "p75": None,
        }
        assert response.data["measurements.fcp"] == {
            "good": 0,
            "meh": 0,
            "poor": 0,
            "total": 0,
            "p75": None,
        }

    def test_edges_of_vital_thresholds(self):
        self.store_event(
            load_data("transaction", timestamp=self.start),
            {"lcp": 4000, "fp": 1000, "fcp": 0},
            project_id=self.project.id,
        )

        self.query.update({"vital": ["measurements.lcp", "measurements.fp", "measurements.fcp"]})
        response = self.do_request()
        assert response.status_code == 200, response.data
        assert not response.data["meta"]["isMetricsData"]
        assert response.data["measurements.lcp"] == {
            "good": 0,
            "meh": 0,
            "poor": 1,
            "total": 1,
            "p75": 4000,
        }
        assert response.data["measurements.fp"] == {
            "good": 0,
            "meh": 1,
            "poor": 0,
            "total": 1,
            "p75": 1000,
        }
        assert response.data["measurements.fcp"] == {
            "good": 1,
            "meh": 0,
            "poor": 0,
            "total": 1,
            "p75": 0,
        }


class OrganizationEventsMetricsEnhancedPerformanceEndpointTest(MetricsEnhancedPerformanceTestCase):
    METRIC_STRINGS = ["measurement_rating"]

    def setUp(self):
        super().setUp()
        self.start = before_now(days=1).replace(hour=10, minute=0, second=0, microsecond=0)
        self.end = self.start + timedelta(hours=6)

        self.query: dict[str, str | list[str]] = {
            "start": self.start.isoformat(),
            "end": self.end.isoformat(),
        }
        self.features = {"organizations:performance-use-metrics": True}

    def do_request(self, query=None, features=None):
        if features is None:
            features = {"organizations:discover-basic": True}
        features.update(self.features)
        if query is None:
            query = self.query
        query["dataset"] = "metricsEnhanced"

        self.login_as(user=self.user)
        with self.feature(features):
            url = reverse(
                "sentry-api-0-organization-events-vitals",
                kwargs={"organization_id_or_slug": self.organization.slug},
            )

        with self.feature(features):
            return self.client.get(url, query, format="json")

    def test_no_projects(self):
        response = self.do_request()
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_no_vitals(self):
        self.query.update({"vital": [], "project": self.project.id})
        response = self.do_request()
        assert response.status_code == 400, response.content
        assert "Need to pass at least one vital" == response.data["detail"]

    def test_simple(self):
        for rating, lcp in [("good", 2000), ("meh", 3000), ("poor", 5000)]:
            self.store_transaction_metric(
                lcp,
                metric="measurements.lcp",
                tags={"transaction": "foo_transaction", "measurement_rating": rating},
                timestamp=self.start + timedelta(minutes=5),
            )

        self.query.update({"vital": ["measurements.lcp"]})
        response = self.do_request()
        assert response.status_code == 200, response.content
        assert response.data["meta"]["isMetricsData"]
        assert response.data["measurements.lcp"] == {
            "good": 1,
            "meh": 1,
            "poor": 1,
            "total": 3,
            "p75": 4000,
        }

    def test_grouping(self):
        counts = [
            ("good", 100, 2),
            ("meh", 3000, 3),
            ("poor", 4500, 1),
        ]
        for rating, duration, count in counts:
            for _ in range(count):
                self.store_transaction_metric(
                    duration,
                    metric="measurements.lcp",
                    tags={"transaction": "foo_transaction", "measurement_rating": rating},
                    timestamp=self.start + timedelta(minutes=5),
                )

        self.query.update({"vital": ["measurements.lcp"]})
        response = self.do_request()
        assert response.status_code == 200
        assert response.data["meta"]["isMetricsData"]
        assert response.data["measurements.lcp"] == {
            "good": 2,
            "meh": 3,
            "poor": 1,
            "total": 6,
            "p75": 3000,
        }

    def test_multiple_vitals(self):
        vitals = [
            ("measurements.lcp", 3000, "meh"),
            ("measurements.fid", 50, "good"),
            ("measurements.cls", 0.15, "meh"),
            ("measurements.fcp", 5000, "poor"),
            ("measurements.fp", 4000, "poor"),
        ]
        for vital, duration, rating in vitals:
            self.store_transaction_metric(
                duration,
                metric=vital,
                tags={"transaction": "foo_transaction", "measurement_rating": rating},
                timestamp=self.start + timedelta(minutes=5),
            )

        self.query.update(
            {
                "vital": [
                    "measurements.lcp",
                    "measurements.fid",
                    "measurements.cls",
                    "measurements.fcp",
                    "measurements.fp",
                ]
            }
        )
        response = self.do_request()
        assert response.status_code == 200
        assert response.data["meta"]["isMetricsData"]
        assert response.data["measurements.lcp"] == {
            "good": 0,
            "meh": 1,
            "poor": 0,
            "total": 1,
            "p75": 3000,
        }
        assert response.data["measurements.fid"] == {
            "good": 1,
            "meh": 0,
            "poor": 0,
            "total": 1,
            "p75": 50,
        }
        assert response.data["measurements.cls"] == {
            "good": 0,
            "meh": 1,
            "poor": 0,
            "total": 1,
            "p75": 0.15,
        }
        assert response.data["measurements.fcp"] == {
            "good": 0,
            "meh": 0,
            "poor": 1,
            "total": 1,
            "p75": 5000,
        }
        assert response.data["measurements.fp"] == {
            "good": 0,
            "meh": 0,
            "poor": 1,
            "total": 1,
            "p75": 4000,
        }

    def test_transactions_without_vitals(self):
        self.query.update(
            {"vital": ["measurements.lcp", "measurements.fcp"], "project": self.project.id}
        )
        response = self.do_request()
        assert response.status_code == 200, response.data
        assert response.data["meta"]["isMetricsData"]
        assert response.data["measurements.lcp"] == {
            "good": 0,
            "meh": 0,
            "poor": 0,
            "total": 0,
            "p75": 0,
        }
        assert response.data["measurements.fcp"] == {
            "good": 0,
            "meh": 0,
            "poor": 0,
            "total": 0,
            "p75": 0,
        }
