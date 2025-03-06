from datetime import timedelta
from typing import Any
from unittest import mock

import pytest
from django.urls import reverse

from sentry.snuba.metrics.naming_layer import TransactionMRI
from sentry.testutils.cases import MetricsAPIBaseTestCase
from sentry.testutils.helpers.datetime import freeze_time

pytestmark = pytest.mark.sentry_metrics


@freeze_time(MetricsAPIBaseTestCase.MOCK_DATETIME)
class OrganizationEventsTrendsStatsV2EndpointTest(MetricsAPIBaseTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.url = reverse("sentry-api-0-organization-events-trends-statsv2", args=[self.org.slug])

        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "foo"},
            org_id=self.org.id,
            project_id=self.project.id,
            value=1,
            hours_before_now=1,
        )
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "foo"},
            org_id=self.org.id,
            project_id=self.project.id,
            value=2,
            hours_before_now=2,
        )
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "foo"},
            org_id=self.org.id,
            project_id=self.project.id,
            value=2,
            hours_before_now=2,
        )

        self.features = {
            "organizations:performance-view": True,
            "organizations:performance-new-trends": True,
        }

    @property
    def now(self):
        return MetricsAPIBaseTestCase.MOCK_DATETIME

    def test_no_feature_flag(self):
        response = self.client.get(
            self.url,
            format="json",
            data={
                "end": self.now - timedelta(minutes=1),
                "start": self.now - timedelta(hours=4),
                "field": ["project", "transaction"],
                "query": "event.type:transaction",
            },
        )

        assert response.status_code == 404, response.content

    def test_no_project(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": self.now - timedelta(minutes=1),
                    "start": self.now - timedelta(hours=4),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "",
                },
            )

        assert response.status_code == 200, response.content
        assert response.data == []

    @mock.patch("sentry.api.endpoints.organization_events_trends_v2.detect_breakpoints")
    def test_simple_with_trends(self, mock_detect_breakpoints):
        mock_trends_result = [
            {
                "project": self.project.id,
                "transaction": "foo",
                "change": "regression",
                "trend_difference": -15,
                "trend_percentage": 0.88,
            }
        ]
        mock_detect_breakpoints.return_value = {"data": mock_trends_result}

        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": self.now,
                    "start": self.now - timedelta(days=1),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "project": self.project.id,
                },
            )

        assert response.status_code == 200, response.content

        events = response.data["events"]
        result_stats = response.data["stats"]

        assert len(events["data"]) == 1
        assert events["data"] == mock_trends_result

        assert len(result_stats) > 0
        assert len(result_stats.get(f"{self.project.id},foo", [])) > 0

    @mock.patch("sentry.api.endpoints.organization_events_trends_v2.detect_breakpoints")
    def test_simple_with_no_trends(self, mock_detect_breakpoints):
        mock_trends_result: list[dict[str, Any] | None] = []
        mock_detect_breakpoints.return_value = {"data": mock_trends_result}

        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": self.now,
                    "start": self.now - timedelta(days=1),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "project": self.project.id,
                },
            )

        assert response.status_code == 200, response.content

        events = response.data["events"]
        result_stats = response.data["stats"]

        assert len(events["data"]) == 0
        assert events["data"] == []

        assert len(result_stats) == 0

    @mock.patch("sentry.api.endpoints.organization_events_trends_v2.detect_breakpoints")
    def test_simple_with_transaction_query(self, mock_detect_breakpoints):
        mock_trends_result: list[dict[str, Any] | None] = []
        mock_detect_breakpoints.return_value = {"data": mock_trends_result}

        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "bar"},
            org_id=self.org.id,
            project_id=self.project.id,
            value=2,
            hours_before_now=2,
        )

        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": self.now,
                    "start": self.now - timedelta(days=1),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction transaction:foo",
                    "project": self.project.id,
                },
            )

        trends_call_args_data = mock_detect_breakpoints.call_args[0][0]["data"]
        assert len(trends_call_args_data.get(f"{self.project.id},foo")) > 0
        assert len(trends_call_args_data.get(f"{self.project.id},bar", [])) == 0

        assert response.status_code == 200, response.content

    @mock.patch("sentry.api.endpoints.organization_events_trends_v2.detect_breakpoints")
    def test_simple_with_trends_p75(self, mock_detect_breakpoints):
        mock_trends_result = [
            {
                "project": self.project.id,
                "transaction": "foo",
                "change": "regression",
                "trend_difference": -15,
                "trend_percentage": 0.88,
            }
        ]
        mock_detect_breakpoints.return_value = {"data": mock_trends_result}

        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": self.now,
                    "start": self.now - timedelta(days=1),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "project": self.project.id,
                    "trendFunction": "p75(transaction.duration)",
                },
            )

        assert response.status_code == 200, response.content

        events = response.data["events"]
        result_stats = response.data["stats"]

        assert len(events["data"]) == 1
        assert events["data"] == mock_trends_result

        assert len(result_stats) > 0
        assert len(result_stats.get(f"{self.project.id},foo", [])) > 0

    @mock.patch("sentry.api.endpoints.organization_events_trends_v2.detect_breakpoints")
    def test_simple_with_trends_p95(self, mock_detect_breakpoints):
        mock_trends_result = [
            {
                "project": self.project.id,
                "transaction": "foo",
                "change": "regression",
                "trend_difference": -15,
                "trend_percentage": 0.88,
            }
        ]
        mock_detect_breakpoints.return_value = {"data": mock_trends_result}

        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": self.now,
                    "start": self.now - timedelta(days=1),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "project": self.project.id,
                    "trendFunction": "p95(transaction.duration)",
                },
            )

        assert response.status_code == 200, response.content

        events = response.data["events"]
        result_stats = response.data["stats"]

        assert len(events["data"]) == 1
        assert events["data"] == mock_trends_result

        assert len(result_stats) > 0
        assert len(result_stats.get(f"{self.project.id},foo", [])) > 0

    @mock.patch("sentry.api.endpoints.organization_events_trends_v2.detect_breakpoints")
    def test_simple_with_top_events(self, mock_detect_breakpoints):
        # store second metric but with lower count
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "bar"},
            org_id=self.org.id,
            project_id=self.project.id,
            value=2,
            hours_before_now=2,
        )

        with self.feature(self.features):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": self.now,
                    "start": self.now - timedelta(days=1),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "project": self.project.id,
                    "trendFunction": "p95(transaction.duration)",
                    "topEvents": 1,
                },
            )

        assert response.status_code == 200, response.content

        trends_call_args_data = mock_detect_breakpoints.call_args[0][0]["data"]
        assert len(trends_call_args_data.get(f"{self.project.id},foo")) > 0
        # checks that second transaction wasn't sent to the trends microservice
        assert len(trends_call_args_data.get(f"{self.project.id},bar", [])) == 0

    @mock.patch("sentry.api.endpoints.organization_events_trends_v2.detect_breakpoints")
    def test_two_projects_same_transaction(self, mock_detect_breakpoints):
        project1 = self.create_project(organization=self.org)
        project2 = self.create_project(organization=self.org)

        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "bar"},
            org_id=self.org.id,
            project_id=project1.id,
            value=2,
            hours_before_now=2,
        )
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "bar"},
            org_id=self.org.id,
            project_id=project2.id,
            value=2,
            hours_before_now=2,
        )

        with self.feature([*self.features, "organizations:global-views"]):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": self.now,
                    "start": self.now - timedelta(days=1),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "project": [project1.id, project2.id],
                    "trendFunction": "p95(transaction.duration)",
                    "topEvents": 2,
                },
            )

        assert response.status_code == 200, response.content

        trends_call_args_data = mock_detect_breakpoints.call_args[0][0]["data"]

        assert len(trends_call_args_data.get(f"{project1.id},bar")) > 0
        assert len(trends_call_args_data.get(f"{project2.id},bar")) > 0

    @mock.patch("sentry.api.endpoints.organization_events_trends_v2.detect_breakpoints")
    @mock.patch("sentry.api.endpoints.organization_events_trends_v2.EVENTS_PER_QUERY", 2)
    def test_two_projects_same_transaction_split_queries(self, mock_detect_breakpoints):
        project1 = self.create_project(organization=self.org)
        project2 = self.create_project(organization=self.org)

        # force these 2 transactions from different projects
        # to fall into the FIRST bucket when querying
        for i in range(2):
            self.store_performance_metric(
                name=TransactionMRI.DURATION.value,
                tags={"transaction": "foo bar*"},
                org_id=self.org.id,
                project_id=project1.id,
                value=2,
                hours_before_now=2,
            )
            self.store_performance_metric(
                name=TransactionMRI.DURATION.value,
                tags={"transaction": 'foo bar\\\\"'},
                org_id=self.org.id,
                project_id=project2.id,
                value=2,
                hours_before_now=2,
            )
        # force these 2 transactions from different projects
        # to fall into the SECOND bucket when querying
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": "foo bar*"},
            org_id=self.org.id,
            project_id=project2.id,
            value=2,
            hours_before_now=2,
        )
        self.store_performance_metric(
            name=TransactionMRI.DURATION.value,
            tags={"transaction": 'foo bar\\\\"'},
            org_id=self.org.id,
            project_id=project1.id,
            value=2,
            hours_before_now=2,
        )

        with self.feature([*self.features, "organizations:global-views"]):
            response = self.client.get(
                self.url,
                format="json",
                data={
                    "end": self.now,
                    "start": self.now - timedelta(days=1),
                    "interval": "1h",
                    "field": ["project", "transaction"],
                    "query": "event.type:transaction",
                    "project": [project1.id, project2.id],
                    "trendFunction": "p95(transaction.duration)",
                    "topEvents": 4,
                    "statsPeriod": "3h",
                },
            )

        assert response.status_code == 200, response.content

        trends_call_args_data_1 = mock_detect_breakpoints.call_args_list[0][0][0]["data"]
        trends_call_args_data_2 = mock_detect_breakpoints.call_args_list[1][0][0]["data"]

        # the order the calls happen in is non-deterministic because of the async
        # nature making making the requests in a thread pool so check that 1 of
        # the 2 possibilities happened
        assert (
            len(trends_call_args_data_1.get(f"{project1.id},foo bar*", {})) > 0
            and len(trends_call_args_data_1.get(f'{project2.id},foo bar\\\\"', {})) > 0
            and len(trends_call_args_data_2.get(f'{project1.id},foo bar\\\\"', {})) > 0
            and len(trends_call_args_data_2.get(f"{project2.id},foo bar*", {})) > 0
        ) or (
            len(trends_call_args_data_1.get(f'{project1.id},foo bar\\\\"', {})) > 0
            and len(trends_call_args_data_1.get(f"{project2.id},foo bar*", {})) > 0
            and len(trends_call_args_data_2.get(f"{project1.id},foo bar*", {})) > 0
            and len(trends_call_args_data_2.get(f'{project2.id},foo bar\\\\"', {})) > 0
        )

        for trends_call_args_data in [trends_call_args_data_1, trends_call_args_data_2]:
            for k, v in trends_call_args_data.items():
                count = 0
                for entry in v["data"]:
                    # each entry should have exactly 1 data point
                    assert len(entry[1]) == 1
                    count += entry[1][0]["count"]
                assert count > 0, k  # make sure the timeseries has some data
