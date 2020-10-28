from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import Dashboard
from sentry.testutils import APITestCase


class OrganizationDashboardsTest(APITestCase):
    def setUp(self):
        super(OrganizationDashboardsTest, self).setUp()
        self.login_as(self.user)
        self.url = reverse(
            "sentry-api-0-organization-dashboards",
            kwargs={"organization_slug": self.organization.slug},
        )
        self.dashboard_1 = Dashboard.objects.create(
            title="Dashboard 1", created_by=self.user, organization=self.organization
        )
        self.dashboard_2 = Dashboard.objects.create(
            title="Dashboard 2", created_by=self.user, organization=self.organization
        )

    def assert_equal_dashboards(self, dashboard, data):
        assert data["id"] == six.text_type(dashboard.id)
        assert data["organization"] == six.text_type(dashboard.organization.id)
        assert data["title"] == dashboard.title
        assert data["createdBy"] == six.text_type(dashboard.created_by.id)

    def test_get(self):
        response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        self.assert_equal_dashboards(self.dashboard_1, response.data[0])
        self.assert_equal_dashboards(self.dashboard_2, response.data[1])

    def test_post(self):
        response = self.client.post(self.url, data={"title": "Dashboard from Post"})
        assert response.status_code == 201
        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard from Post"
        )
        assert dashboard.created_by == self.user

    def test_query(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard 11", created_by=self.user, organization=self.organization
        )
        response = self.client.get(self.url, data={"query": "1"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        self.assert_equal_dashboards(self.dashboard_1, response.data[0])
        self.assert_equal_dashboards(dashboard, response.data[1])

    def test_query_no_results(self):
        response = self.client.get(self.url, data={"query": "not-in-there"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_invalid_data(self):
        response = self.client.post(self.url, data={"malformed-data": "Dashboard from Post"})
        assert response.status_code == 400

    def test_integrity_error(self):
        response = self.client.post(self.url, data={"title": self.dashboard_1.title})
        assert response.status_code == 409
        assert response.data == "This dashboard already exists"
