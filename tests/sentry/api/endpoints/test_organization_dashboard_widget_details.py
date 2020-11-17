from __future__ import absolute_import

from sentry.models import (
    Dashboard,
    DashboardWidget,
    DashboardWidgetQuery,
    DashboardWidgetDisplayTypes,
)
from sentry.testutils import OrganizationDashboardWidgetTestCase


class OrganizationDashboardWidgetDetailsTestCase(OrganizationDashboardWidgetTestCase):
    endpoint = "sentry-api-0-organization-dashboard-widget-details"

    def setUp(self):
        super(OrganizationDashboardWidgetDetailsTestCase, self).setUp()
        self.widget = DashboardWidget.objects.create(
            dashboard_id=self.dashboard.id,
            order=1,
            title="Widget 1",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
        )


class OrganizationDashboardWidgetDetailsPutTestCase(OrganizationDashboardWidgetDetailsTestCase):
    method = "put"

    def test_simple(self):
        queries = [
            self.known_users_query,
            self.anon_users_query,
        ]
        response = self.get_response(
            self.organization.slug,
            self.dashboard.id,
            self.widget.id,
            displayType="line",
            title="User Happiness",
            queries=queries,
        )
        assert response.status_code == 200, response.data

        self.assert_widget_data(
            response.data, title="User Happiness", display_type="line", queries=queries,
        )

        widgets = DashboardWidget.objects.filter(dashboard_id=self.dashboard.id)
        assert len(widgets) == 1

        self.assert_widget(
            widgets[0],
            order=1,
            title="User Happiness",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            queries=queries,
        )

    def test_widget_no_data_souces(self):
        DashboardWidgetQuery.objects.create(
            name="known users",
            conditions=self.known_users_query["conditions"],
            fields=self.known_users_query["fields"],
            interval=self.known_users_query["interval"],
            order=1,
            widget_id=self.widget.id,
        )
        response = self.get_response(
            self.organization.slug,
            self.dashboard.id,
            self.widget.id,
            displayType="line",
            title="User Happiness",
            queries=[],
        )
        assert response.status_code == 200
        self.assert_widget_data(response.data, title="User Happiness", display_type="line")

        widgets = DashboardWidget.objects.filter(dashboard_id=self.dashboard.id)
        assert len(widgets) == 1

        self.assert_widget(
            widgets[0],
            order=1,
            title="User Happiness",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
        )
        assert not DashboardWidgetQuery.objects.filter(widget_id=widgets[0]).exists()

    def test_unrecognized_display_type(self):
        response = self.get_response(
            self.organization.slug,
            self.dashboard.id,
            self.widget.id,
            displayType="happy-face",
            title="User Happiness",
        )
        assert response.status_code == 400
        assert response.data == {"displayType": [u'"happy-face" is not a valid choice.']}

    def test_does_not_exists(self):
        response = self.get_response(
            self.organization.slug,
            self.dashboard.id,
            1234567890,
            displayType="line",
            title="User Happiness",
        )
        assert response.status_code == 404

    def test_widget_does_not_belong_to_dashboard(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard 2", created_by=self.user, organization=self.organization
        )
        widget = DashboardWidget.objects.create(
            dashboard_id=dashboard.id,
            order=1,
            title="Widget 2",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
        )
        response = self.get_response(
            self.organization.slug,
            self.dashboard.id,
            widget.id,
            displayType="line",
            title="Happy Widget 2",
        )
        assert response.status_code == 404

    def test_widget_does_not_belong_to_organization(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard 2", created_by=self.user, organization=self.create_organization()
        )
        widget = DashboardWidget.objects.create(
            dashboard_id=dashboard.id,
            order=1,
            title="Widget 2",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
        )
        response = self.get_response(
            self.organization.slug,
            dashboard.id,
            widget.id,
            displayType="line",
            title="Happy Widget 2",
        )
        assert response.status_code == 404


class OrganizationDashboardWidgetsDeleteTestCase(OrganizationDashboardWidgetDetailsTestCase):
    method = "delete"

    def assert_deleted_widget(self, widget_id):
        assert not DashboardWidget.objects.filter(id=widget_id).exists()
        assert not DashboardWidgetQuery.objects.filter(widget_id=widget_id).exists()

    def test_simple(self):
        response = self.get_response(self.organization.slug, self.dashboard.id, self.widget.id)
        assert response.status_code == 204
        self.assert_deleted_widget(self.widget.id)

    def test_with_queries(self):
        DashboardWidgetQuery.objects.create(
            widget_id=self.widget.id,
            name="Known users",
            conditions=self.known_users_query["conditions"],
            fields=self.known_users_query["fields"],
            interval=self.known_users_query["interval"],
            order=1,
        )
        DashboardWidgetQuery.objects.create(
            widget_id=self.widget.id,
            name="Anon users",
            conditions=self.anon_users_query["conditions"],
            fields=self.anon_users_query["fields"],
            interval=self.anon_users_query["interval"],
            order=2,
        )
        response = self.get_response(self.organization.slug, self.dashboard.id, self.widget.id)
        assert response.status_code == 204
        self.assert_deleted_widget(self.widget.id)

    def test_does_not_exists(self):
        response = self.get_response(self.organization.slug, self.dashboard.id, 1234567890)
        assert response.status_code == 404

    def test_widget_does_not_belong_to_dashboard(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard 2", created_by=self.user, organization=self.organization
        )
        widget = DashboardWidget.objects.create(
            dashboard_id=dashboard.id,
            order=1,
            title="Widget 2",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
        )
        response = self.get_response(
            self.organization.slug,
            self.dashboard.id,
            widget.id,
            displayType="line",
            title="Happy Widget 2",
        )
        assert response.status_code == 404

    def test_widget_does_not_belong_to_organization(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard 2", created_by=self.user, organization=self.create_organization()
        )
        widget = DashboardWidget.objects.create(
            dashboard_id=dashboard.id,
            order=1,
            title="Widget 2",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
        )
        response = self.get_response(
            self.organization.slug,
            dashboard.id,
            widget.id,
            displayType="line",
            title="Happy Widget 2",
        )
        assert response.status_code == 404
