from unittest import mock

import pytest
from django.urls import reverse
from rest_framework.exceptions import ParseError

from sentry.issues.grouptype import ProfileFileIOGroupType
from sentry.testutils.cases import APITestCase, MetricsEnhancedPerformanceTestCase, SnubaTestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import SearchIssueTestMixin

pytestmark = pytest.mark.sentry_metrics


class OrganizationEventsMetaEndpoint(
    APITestCase, MetricsEnhancedPerformanceTestCase, SearchIssueTestMixin
):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.login_as(user=self.user)
        self.project = self.create_project()
        self.url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        self.features = {"organizations:discover-basic": True}

    def test_simple(self):

        self.store_event(data={"timestamp": self.min_ago.isoformat()}, project_id=self.project.id)

        with self.feature(self.features):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 1

    def test_multiple_projects(self):
        project2 = self.create_project()

        self.store_event(data={"timestamp": self.min_ago.isoformat()}, project_id=self.project.id)
        self.store_event(data={"timestamp": self.min_ago.isoformat()}, project_id=project2.id)

        response = self.client.get(self.url, format="json")

        assert response.status_code == 400, response.content

        self.features["organizations:global-views"] = True
        with self.feature(self.features):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 2

    def test_search(self):
        self.store_event(
            data={"timestamp": self.min_ago.isoformat(), "message": "how to make fast"},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": self.min_ago.isoformat(), "message": "Delete the Data"},
            project_id=self.project.id,
        )

        with self.feature(self.features):
            response = self.client.get(self.url, {"query": "delete"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 1

    def test_custom_measurements_query_uses_units(self):
        self.store_transaction_metric(
            33,
            metric="measurements.custom",
            internal_metric="d:transactions/measurements.custom@second",
            entity="metrics_distributions",
            tags={"transaction": "foo_transaction"},
            timestamp=self.min_ago,
        )
        data = load_data("transaction", timestamp=self.min_ago)
        data["measurements"] = {
            "custom": {"value": 0.199, "unit": "second"},
        }
        self.store_event(data, self.project.id)
        data = load_data("transaction", timestamp=self.min_ago)
        data["measurements"] = {
            "custom": {"value": 0.201, "unit": "second"},
        }
        self.store_event(data, self.project.id)
        url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        features = {
            "organizations:discover-basic": True,
            "organizations:performance-use-metrics": True,
        }
        for dataset in ["discover", "transactions"]:
            query = {
                "field": ["measurements.custom"],
                "query": "measurements.custom:>200",
                "dataset": dataset,
            }
            with self.feature(features):
                response = self.client.get(url, query, format="json")
            assert response.status_code == 200, response.content
            assert response.data["count"] == 1

    def test_invalid_query(self):
        with self.feature(self.features):
            response = self.client.get(
                self.url, {"query": "is:unresolved priority:[high, medium]"}, format="json"
            )

        assert response.status_code == 400, response.content

    def test_no_projects(self):
        no_project_org = self.create_organization(owner=self.user)

        url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_id_or_slug": no_project_org.slug},
        )
        with self.feature(self.features):
            response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 0

    def test_transaction_event(self):
        data = {
            "event_id": "a" * 32,
            "type": "transaction",
            "transaction": "api.issue.delete",
            "spans": [],
            "contexts": {"trace": {"op": "foobar", "trace_id": "a" * 32, "span_id": "a" * 16}},
            "tags": {"important": "yes"},
            "timestamp": before_now(minutes=1).isoformat(),
            "start_timestamp": before_now(minutes=1, seconds=3).isoformat(),
        }
        self.store_event(data=data, project_id=self.project.id)
        url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        with self.feature(self.features):
            response = self.client.get(url, {"query": "transaction.duration:>1"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 1

    def test_generic_event(self):
        """Test that the issuePlatform dataset returns data for a generic issue's short ID"""
        _, _, group_info = self.store_search_issue(
            self.project.id,
            self.user.id,
            [f"{ProfileFileIOGroupType.type_id}-group1"],
            "prod",
            before_now(hours=1),
        )
        assert group_info is not None
        url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        with self.feature(self.features):
            response = self.client.get(
                url,
                {
                    "query": f"issue:{group_info.group.qualified_short_id}",
                    "dataset": "issuePlatform",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data["count"] == 1

    def test_errors_dataset_event(self):
        """Test that the errors dataset returns data for an issue's short ID"""
        group_1 = self.store_event(
            data={"timestamp": self.min_ago.isoformat()}, project_id=self.project.id
        ).group
        url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_id_or_slug": self.project.organization.slug},
        )
        with self.feature(self.features):
            response = self.client.get(
                url,
                {
                    "query": f"issue:{group_1.qualified_short_id} is:unresolved",
                    "dataset": "errors",
                },
                format="json",
            )

        assert response.status_code == 200, response.content
        assert response.data["count"] == 1

    def test_transaction_event_with_last_seen(self):
        data = {
            "event_id": "a" * 32,
            "type": "transaction",
            "transaction": "api.issue.delete",
            "spans": [],
            "contexts": {"trace": {"op": "foobar", "trace_id": "a" * 32, "span_id": "a" * 16}},
            "tags": {"important": "yes"},
            "timestamp": before_now(minutes=1).isoformat(),
            "start_timestamp": before_now(minutes=1, seconds=3).isoformat(),
        }
        self.store_event(data=data, project_id=self.project.id)
        with self.feature(self.features):
            response = self.client.get(
                self.url, {"query": "event.type:transaction last_seen():>2012-12-31"}, format="json"
            )

        assert response.status_code == 200, response.content
        assert response.data["count"] == 1

    def test_out_of_retention(self):
        with self.feature(self.features):
            with self.options({"system.event-retention-days": 10}):
                response = self.client.get(
                    self.url,
                    format="json",
                    data={
                        "start": before_now(days=20).isoformat(),
                        "end": before_now(days=15).isoformat(),
                    },
                )
        assert response.status_code == 400

    @mock.patch("sentry.search.events.builder.base.raw_snql_query")
    def test_handling_snuba_errors(self, mock_snql_query):
        mock_snql_query.side_effect = ParseError("test")
        with self.feature(self.features):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 400, response.content

    @mock.patch("sentry.utils.snuba.quantize_time")
    def test_quantize_dates(self, mock_quantize):
        mock_quantize.return_value = before_now(days=1)
        with self.feature(self.features):
            # Don't quantize short time periods
            self.client.get(
                self.url,
                format="json",
                data={"statsPeriod": "1h", "query": "", "field": ["id", "timestamp"]},
            )
            # Don't quantize absolute date periods
            self.client.get(
                self.url,
                format="json",
                data={
                    "start": before_now(days=20).isoformat(),
                    "end": before_now(days=15).isoformat(),
                    "query": "",
                    "field": ["id", "timestamp"],
                },
            )

            assert len(mock_quantize.mock_calls) == 0

            # Quantize long date periods
            self.client.get(
                self.url,
                format="json",
                data={"field": ["id", "timestamp"], "statsPeriod": "90d", "query": ""},
            )

            assert len(mock_quantize.mock_calls) == 2


class OrganizationEventsRelatedIssuesEndpoint(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

    def test_find_related_issue(self):
        self.login_as(user=self.user)

        project = self.create_project()
        event1 = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat(), "transaction": "/beth/sanchez"},
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-organization-related-issues",
            kwargs={"organization_id_or_slug": project.organization.slug},
        )
        response = self.client.get(url, {"transaction": "/beth/sanchez"}, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["shortId"] == event1.group.qualified_short_id
        assert int(response.data[0]["id"]) == event1.group_id

    def test_related_issues_no_transaction(self):
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat(), "transaction": "/beth/sanchez"},
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-organization-related-issues",
            kwargs={"organization_id_or_slug": project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 400, response.content
        assert (
            response.data["detail"]
            == "Must provide one of ['transaction'] in order to find related events"
        )

    def test_related_issues_no_matching_groups(self):
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat(), "transaction": "/beth/sanchez"},
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-organization-related-issues",
            kwargs={"organization_id_or_slug": project.organization.slug},
        )
        response = self.client.get(url, {"transaction": "/morty/sanchez"}, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_related_issues_only_issues_in_date(self):
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(days=2).isoformat(),
                "transaction": "/beth/sanchez",
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
                "transaction": "/beth/sanchez",
            },
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-organization-related-issues",
            kwargs={"organization_id_or_slug": project.organization.slug},
        )
        response = self.client.get(
            url, {"transaction": "/beth/sanchez", "statsPeriod": "24h"}, format="json"
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["shortId"] == event2.group.qualified_short_id
        assert int(response.data[0]["id"]) == event2.group_id

    def test_related_issues_transactions_from_different_projects(self):
        self.login_as(user=self.user)

        project1 = self.create_project()
        project2 = self.create_project()
        event1 = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
                "transaction": "/beth/sanchez",
            },
            project_id=project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
                "transaction": "/beth/sanchez",
            },
            project_id=project2.id,
        )

        url = reverse(
            "sentry-api-0-organization-related-issues",
            kwargs={"organization_id_or_slug": project1.organization.slug},
        )
        response = self.client.get(
            url,
            {"transaction": "/beth/sanchez", "project": str(project1.id)},
            format="json",
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["shortId"] == event1.group.qualified_short_id
        assert int(response.data[0]["id"]) == event1.group_id

    def test_related_issues_transactions_with_quotes(self):
        self.login_as(user=self.user)

        project = self.create_project()
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": before_now(minutes=1).isoformat(),
                "transaction": '/beth/"sanchez"',
            },
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-organization-related-issues",
            kwargs={"organization_id_or_slug": project.organization.slug},
        )
        response = self.client.get(
            url,
            {"transaction": '/beth/"sanchez"', "project": str(project.id)},
            format="json",
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["shortId"] == event.group.qualified_short_id
        assert int(response.data[0]["id"]) == event.group_id

        url = reverse(
            "sentry-api-0-organization-related-issues",
            kwargs={"organization_id_or_slug": project.organization.slug},
        )
        response = self.client.get(
            url,
            {"transaction": '/beth/\\"sanchez\\"', "project": str(project.id)},
            format="json",
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["shortId"] == event.group.qualified_short_id
        assert int(response.data[0]["id"]) == event.group_id


class OrganizationSpansSamplesEndpoint(APITestCase, SnubaTestCase):
    url_name = "sentry-api-0-organization-spans-samples"

    @mock.patch("sentry.search.events.builder.base.raw_snql_query")
    def test_is_segment_properly_converted_in_filter(self, mock_raw_snql_query):
        self.login_as(user=self.user)
        project = self.create_project()
        url = reverse(self.url_name, kwargs={"organization_id_or_slug": project.organization.slug})

        response = self.client.get(
            url,
            {
                "query": "span.is_segment:1 transaction:api/0/foo",
                "lowerBound": "0",
                "firstBound": "10",
                "secondBound": "20",
                "upperBound": "200",
                "column": "span.duration",
            },
            format="json",
            extra={"project": [project.id]},
        )

        assert response.status_code == 200, response.content

        # the SQL should have is_segment converted into an int for all requests
        assert all(
            "is_segment = 1" in call_args[0][0].serialize()
            for call_args in mock_raw_snql_query.call_args_list
        )

    def test_is_using_sample_rate(self):
        self.login_as(user=self.user)
        project = self.create_project()
        url = reverse(self.url_name, kwargs={"organization_id_or_slug": project.organization.slug})

        def request():

            return self.client.get(
                url,
                {
                    "query": "span.is_segment:1 transaction:api/0/foo",
                    "lowerBound": "0",
                    "firstBound": "10",
                    "secondBound": "20",
                    "upperBound": "200",
                    "column": "span.duration",
                },
                format="json",
                extra={"project": [project.id]},
            )

        response = request()

        assert response.status_code == 200, response.content

        with mock.patch("sentry.search.events.builder.base.raw_snql_query") as mock_raw_snql_query:

            response = request()
            assert response.status_code == 200, response.content

            assert "MATCH (spans)" in mock_raw_snql_query.call_args_list[0][0][0].serialize()

        with (
            override_options({"insights.span-samples-query.sample-rate": 100_000_000.0}),
            mock.patch("sentry.search.events.builder.base.raw_snql_query") as mock_raw_snql_query,
        ):

            response = request()
            assert response.status_code == 200, response.content

            assert (
                "MATCH (spans SAMPLE 100000000.0)"
                in mock_raw_snql_query.call_args_list[0][0][0].serialize()
            )
