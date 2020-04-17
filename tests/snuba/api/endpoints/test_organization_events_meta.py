from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class OrganizationEventsMetaEndpoint(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsMetaEndpoint, self).setUp()
        self.min_ago = before_now(minutes=1)
        self.login_as(user=self.user)
        self.project = self.create_project()
        self.url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_slug": self.project.organization.slug},
        )

    def test_simple(self):
        project2 = self.create_project()

        self.store_event(data={"timestamp": iso_format(self.min_ago)}, project_id=self.project.id)
        self.store_event(data={"timestamp": iso_format(self.min_ago)}, project_id=project2.id)

        response = self.client.get(self.url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 2

    def test_search(self):
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "message": "how to make fast"},
            project_id=self.project.id,
        )
        self.store_event(
            data={"timestamp": iso_format(self.min_ago), "message": "Delet the Data"},
            project_id=self.project.id,
        )

        response = self.client.get(self.url, {"query": "delet"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 1

    def test_invalid_query(self):
        response = self.client.get(self.url, {"query": "is:unresolved"}, format="json")

        assert response.status_code == 400, response.content

    def test_no_projects(self):
        no_project_org = self.create_organization(owner=self.user)

        url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_slug": no_project_org.slug},
        )
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
        response = self.client.get(
            self.url, {"query": "event.type:transaction last_seen:>2012-12-31"}, format="json"
        )

        assert response.status_code == 200, response.content
        assert response.data["count"] == 1
