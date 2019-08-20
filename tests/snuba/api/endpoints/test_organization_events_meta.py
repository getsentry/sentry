from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationEventsMetaEndpoint(APITestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationEventsMetaEndpoint, self).setUp()
        self.min_ago = before_now(minutes=1)

    def test_simple(self):
        self.login_as(user=self.user)

        project = self.create_project()
        project2 = self.create_project()
        group = self.create_group(project=project)
        group2 = self.create_group(project=project2)
        self.create_event(event_id="a" * 32, group=group, datetime=self.min_ago)
        self.create_event(event_id="m" * 32, group=group2, datetime=self.min_ago)

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
        group = self.create_group(project=project)
        self.create_event(
            event_id="x" * 32, group=group, message="how to make fast", datetime=self.min_ago
        )
        self.create_event(
            event_id="m" * 32, group=group, message="Delet the Data", datetime=self.min_ago
        )

        url = reverse(
            "sentry-api-0-organization-events-meta",
            kwargs={"organization_slug": project.organization.slug},
        )
        response = self.client.get(url, {"query": "delet"}, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 1

    def test_no_projects(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-organization-events-meta", kwargs={"organization_slug": org.slug}
        )
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["count"] == 0
