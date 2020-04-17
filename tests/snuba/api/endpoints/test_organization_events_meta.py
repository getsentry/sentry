from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class OrganizationEventsMetaEndpoint(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsMetaEndpoint, self).setUp()
        self.min_ago = before_now(minutes=1)

    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        project2 = self.create_project()

        self.store_event(data={"timestamp": iso_format(self.min_ago)}, project_id=project.id)
        self.store_event(data={"timestamp": iso_format(self.min_ago)}, project_id=project2.id)

        url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_slug": project.organization.slug},
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 2

    def test_search(self):
        self.login_as(user=self.user)

        project = self.create_project()
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "message": "how to make fast"},
            project_id=project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "message": "Delet the Data"},
            project_id=project.id,
        )

        url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_slug": project.organization.slug},
        )
        response = self.client.get(url, {"query": "delet"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 1

    def test_invalid_query(self):
        self.login_as(user=self.user)
        project = self.create_project()

        url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_slug": project.organization.slug},
        )
        response = self.client.get(url, {"query": "is:unresolved"}, format="json")

        assert response.status_code == 400, response.content

    def test_no_projects(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-organization-events-meta", kwargs={"organization_slug": org.slug}
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 0

    def test_transaction_event(self):
        self.login_as(user=self.user)

        project = self.create_project()
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
        self.store_event(data=data, project_id=project.id)
        url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_slug": project.organization.slug},
        )
        response = self.client.get(url, {"query": "transaction.duration:>1"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 1

    def test_transaction_event_with_last_seen(self):
        self.login_as(user=self.user)

        project = self.create_project()
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
        self.store_event(data=data, project_id=project.id)
        url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_slug": project.organization.slug},
        )
        response = self.client.get(
            url, {"query": "event.type:transaction last_seen:>2012-12-31"}, format="json"
        )

        assert response.status_code == 200, response.content
        assert response.data["count"] == 1


class OrganizationEventsRelatedIssuesEndpoint(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsRelatedIssuesEndpoint, self).setUp()

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
            url, {"transaction": "/beth/sanchez", "project": project1.id}, format="json",
        )

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["shortId"] == event1.group.qualified_short_id
        assert int(response.data[0]["id"]) == event1.group_id
