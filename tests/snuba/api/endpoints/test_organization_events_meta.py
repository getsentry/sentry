from unittest import mock

import pytest
from django.urls import reverse
from pytz import utc
from rest_framework.exceptions import ParseError

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test

pytestmark = pytest.mark.sentry_metrics


@region_silo_test
class OrganizationEventsMetaEndpoint(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.login_as(user=self.user)
        self.project = self.create_project()
        self.url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        self.features = {"organizations:discover-basic": True}

    def test_simple(self):

        self.store_event(data={"timestamp": iso_format(self.min_ago)}, project_id=self.project.id)

        with self.feature(self.features):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 1

    def test_multiple_projects(self):
        project2 = self.create_project()

        self.store_event(data={"timestamp": iso_format(self.min_ago)}, project_id=self.project.id)
        self.store_event(data={"timestamp": iso_format(self.min_ago)}, project_id=project2.id)

        response = self.client.get(self.url, format="json")

        assert response.status_code == 400, response.content

        self.features["organizations:global-views"] = True
        with self.feature(self.features):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 2

    def test_search(self):
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "message": "how to make fast"},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "message": "Delete the Data"},
            project_id=self.project.id,
        )

        with self.feature(self.features):
            response = self.client.get(self.url, {"query": "delete"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 1

    def test_invalid_query(self):
        with self.feature(self.features):
            response = self.client.get(self.url, {"query": "is:unresolved"}, format="json")

        assert response.status_code == 400, response.content

    def test_no_projects(self):
        no_project_org = self.create_organization(owner=self.user)

        url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_slug": no_project_org.slug},
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
            "timestamp": iso_format(before_now(minutes=1)),
            "start_timestamp": iso_format(before_now(minutes=1, seconds=3)),
        }
        self.store_event(data=data, project_id=self.project.id)
        url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_slug": self.project.organization.slug},
        )
        with self.feature(self.features):
            response = self.client.get(url, {"query": "transaction.duration:>1"}, format="json")

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
            "timestamp": iso_format(before_now(minutes=1)),
            "start_timestamp": iso_format(before_now(minutes=1, seconds=3)),
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
                        "start": iso_format(before_now(days=20)),
                        "end": iso_format(before_now(days=15)),
                    },
                )
        assert response.status_code == 400

    @mock.patch("sentry.search.events.builder.raw_snql_query")
    def test_handling_snuba_errors(self, mock_snql_query):
        mock_snql_query.side_effect = ParseError("test")
        with self.feature(self.features):
            response = self.client.get(self.url, format="json")

        assert response.status_code == 400, response.content

    @mock.patch("sentry.utils.snuba.quantize_time")
    def test_quantize_dates(self, mock_quantize):
        mock_quantize.return_value = before_now(days=1).replace(tzinfo=utc)
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
                    "start": iso_format(before_now(days=20)),
                    "end": iso_format(before_now(days=15)),
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


@region_silo_test
class OrganizationEventsRelatedIssuesEndpoint(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

    def test_find_related_issue(self):
        self.login_as(user=self.user)

        project = self.create_project()
        event1 = self.store_event(
            data={"timestamp": iso_format(before_now(minutes=1)), "transaction": "/beth/sanchez"},
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-organization-related-issues",
            kwargs={"organization_slug": project.organization.slug},
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
            data={"timestamp": iso_format(before_now(minutes=1)), "transaction": "/beth/sanchez"},
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-organization-related-issues",
            kwargs={"organization_slug": project.organization.slug},
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
            data={"timestamp": iso_format(before_now(minutes=1)), "transaction": "/beth/sanchez"},
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-organization-related-issues",
            kwargs={"organization_slug": project.organization.slug},
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
                "timestamp": iso_format(before_now(days=2)),
                "transaction": "/beth/sanchez",
            },
            project_id=project.id,
        )
        event2 = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
                "transaction": "/beth/sanchez",
            },
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-organization-related-issues",
            kwargs={"organization_slug": project.organization.slug},
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
                "timestamp": iso_format(before_now(minutes=1)),
                "transaction": "/beth/sanchez",
            },
            project_id=project1.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
                "transaction": "/beth/sanchez",
            },
            project_id=project2.id,
        )

        url = reverse(
            "sentry-api-0-organization-related-issues",
            kwargs={"organization_slug": project1.organization.slug},
        )
        response = self.client.get(
            url,
            {"transaction": "/beth/sanchez", "project": project1.id},
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
                "timestamp": iso_format(before_now(minutes=1)),
                "transaction": '/beth/"sanchez"',
            },
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-organization-related-issues",
            kwargs={"organization_slug": project.organization.slug},
        )
        response = self.client.get(
            url,
            {"transaction": '/beth/"sanchez"', "project": project.id},
            format="json",
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["shortId"] == event.group.qualified_short_id
        assert int(response.data[0]["id"]) == event.group_id

        url = reverse(
            "sentry-api-0-organization-related-issues",
            kwargs={"organization_slug": project.organization.slug},
        )
        response = self.client.get(
            url,
            {"transaction": '/beth/\\"sanchez\\"', "project": project.id},
            format="json",
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["shortId"] == event.group.qualified_short_id
        assert int(response.data[0]["id"]) == event.group_id
