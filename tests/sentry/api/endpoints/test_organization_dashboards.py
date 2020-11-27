from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import Dashboard, DashboardWidget, DashboardWidgetDisplayTypes
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

    def get_widgets(self, dashboard_id):
        return DashboardWidget.objects.filter(dashboard_id=dashboard_id).order_by("order")

    def assert_serialized_widget(self, data, expected_widget):
        if "id" in data:
            assert data["id"] == six.text_type(expected_widget.id)
        if "title" in data:
            assert data["title"] == expected_widget.title
        if "interval" in data:
            assert data["interval"] == expected_widget.interval
        if "displayType" in data:
            assert data["displayType"] == DashboardWidgetDisplayTypes.get_type_name(
                expected_widget.display_type
            )

    def assert_equal_dashboards(self, dashboard, data):
        assert data["id"] == six.text_type(dashboard.id)
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

    def test_post_with_widgets(self):
        data = {
            "title": "Dashboard from Post",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": "Transaction count()",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
                {
                    "displayType": "bar",
                    "interval": "5m",
                    "title": "Error count()",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["count()"],
                            "conditions": "event.type:error",
                        }
                    ],
                },
            ],
        }

        response = self.client.post(self.url, data=data)
        assert response.status_code == 201
        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard from Post"
        )
        assert dashboard.created_by == self.user

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 2

        for expected_widget in data["widgets"]:
            for actual_widget in widgets:
                self.assert_serialized_widget(expected_widget, actual_widget)

                queries = actual_widget.dashboardwidgetquery_set.all()
                for expected_query in expected_widget["queries"]:
                    for actual_query in queries:
                        self.assert_serialized_widget_query(expected_query, actual_query)

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
        assert response.data == "Dashboard title already taken"
