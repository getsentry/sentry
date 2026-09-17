import pytest
from django.urls import reverse

from sentry.testutils.cases import (
    APITestCase,
    SnubaTestCase,
)
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.thread_leaks.pytest import thread_leak_allowlist
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase

pytestmark = [
    pytest.mark.sentry_metrics,
    thread_leak_allowlist(reason="sentry sdk background worker", issue=97042),
]


class OrganizationEventsRelatedIssuesEndpoint(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()

    def test_find_related_issue(self) -> None:
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

    def test_related_issues_no_transaction(self) -> None:
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

    def test_related_issues_no_matching_groups(self) -> None:
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

    def test_related_issues_only_issues_in_date(self) -> None:
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

    def test_related_issues_transactions_from_different_projects(self) -> None:
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

    def test_related_issues_transactions_with_quotes(self) -> None:
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


class OrganizationSpansSamplesEndpoint(OrganizationEventsEndpointTestBase, SnubaTestCase):
    url_name = "sentry-api-0-organization-spans-samples"

    def test_basic_query(self) -> None:
        self.login_as(user=self.user)
        project = self.create_project()
        url = reverse(self.url_name, kwargs={"organization_id_or_slug": project.organization.slug})

        span = self.create_span(
            {
                "span_id": "ab4d0a103a55489c",
                "op": "db",
                "description": "SELECT *",
                "sentry_tags": {
                    "op": "db",
                    "category": "db",
                },
            },
            duration=200,
            start_ts=self.ten_mins_ago,
        )
        self.store_span(span)

        response = self.client_get(
            url,
            {
                "query": "",
                "lowerBound": "0",
                "firstBound": "100",
                "secondBound": "200",
                "upperBound": "300",
                "column": "span.duration",
                "project": self.project.id,
            },
            format="json",
        )

        assert response.status_code == 200, response.content

        data = response.data["data"]

        assert data[0]["span.duration"] == 200
        assert data[0]["span_id"] == "ab4d0a103a55489c"
        assert data[0]["project"] == self.project.slug

        meta = response.data["meta"]

        assert meta["fields"]["span.duration"] == "duration"
        assert meta["units"]["span.duration"] == "millisecond"

    def test_order_by(self) -> None:
        self.login_as(user=self.user)
        project = self.create_project()
        url = reverse(self.url_name, kwargs={"organization_id_or_slug": project.organization.slug})

        spans = [
            self.create_span(
                {"description": "SELECT * FROM users"},
                start_ts=self.ten_mins_ago,
                duration=20,
            ),
            self.create_span(
                {"description": "SELECT * FROM orders"},
                start_ts=self.nine_mins_ago,
                duration=200,
            ),
        ]

        self.store_spans(spans)

        response = self.client_get(
            url,
            {
                "lowerBound": "0",
                "firstBound": "100",
                "secondBound": "250",
                "upperBound": "500",
                "project": self.project.id,
                "additionalFields": "span.duration",
                "sort": "-span.duration",
            },
            format="json",
        )

        data = response.data["data"]
        assert data[0]["span.duration"] == 200
        assert data[1]["span.duration"] == 20

        response = self.client_get(
            url,
            {
                "lowerBound": "0",
                "firstBound": "100",
                "secondBound": "250",
                "upperBound": "500",
                "project": self.project.id,
                "additionalFields": "span.duration",
                "sort": "span.duration",
            },
            format="json",
        )

        data = response.data["data"]
        assert data[0]["span.duration"] == 20
        assert data[1]["span.duration"] == 200

    def test_simple(self) -> None:
        self.login_as(user=self.user)
        url = reverse(
            self.url_name, kwargs={"organization_id_or_slug": self.project.organization.slug}
        )

        spans = [
            self.create_span(
                {"description": "bar", "trace_id": "1" * 32},
                start_ts=self.ten_mins_ago,
                duration=20,
            ),
            self.create_span(
                {"description": "bar", "trace_id": "2" * 32},
                start_ts=self.ten_mins_ago,
                duration=100000,
            ),
            self.create_span(
                {"description": "foo", "trace_id": "3" * 32},
                start_ts=self.ten_mins_ago,
                duration=5,
            ),
            self.create_span(
                {
                    "description": "foo",
                    "trace_id": "4" * 32,
                    "sentry_tags": {"profile.id": "1"},
                },
                start_ts=self.ten_mins_ago,
                duration=5,
            ),
            self.create_span(
                {
                    "description": "foo",
                    "trace_id": "5" * 32,
                    "sentry_tags": {"profile.id": "2"},
                },
                start_ts=self.ten_mins_ago,
                duration=20,
            ),
        ]

        self.store_spans(
            spans,
        )

        response = self.client_get(
            url,
            {
                "query": "",
                "lowerBound": "0",
                "firstBound": "10.0",
                "secondBound": "20",
                "upperBound": "200",
                "column": "span.duration",
                "project": self.project.id,
            },
            format="json",
        )
        assert response.status_code == 200, response.content
        data = response.data["data"]
        assert len(data) == 4
        assert data[0]["span_id"] == spans[0]["span_id"]
        assert data[1]["span_id"] == spans[2]["span_id"]
        assert data[2]["span_id"] == spans[3]["span_id"]
        assert data[3]["span_id"] == spans[4]["span_id"]

        meta = response.data["meta"]
        assert meta["fields"]["span.duration"] == "duration"
        assert meta["units"]["span.duration"] == "millisecond"
        assert meta["dataset"] == "spans"
