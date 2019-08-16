from __future__ import absolute_import

from sentry.models import (
    Dashboard,
    Widget,
    WidgetDataSource,
    WidgetDataSourceTypes,
    WidgetDisplayTypes,
)
from sentry.testutils import OrganizationDashboardWidgetTestCase


class OrganizationDashboardWidgetDetailsTestCase(OrganizationDashboardWidgetTestCase):
    endpoint = "sentry-api-0-organization-dashboard-widget-details"

    def setUp(self):
        super(OrganizationDashboardWidgetDetailsTestCase, self).setUp()
        self.widget = Widget.objects.create(
            dashboard_id=self.dashboard.id,
            order=1,
            title="Widget 1",
            display_type=WidgetDisplayTypes.LINE_CHART,
            display_options={},
        )

    def tearDown(self):
        super(OrganizationDashboardWidgetDetailsTestCase, self).tearDown()
        Widget.objects.all().delete()
        WidgetDataSource.objects.all().delete()


class OrganizationDashboardWidgetDetailsPutTestCase(OrganizationDashboardWidgetDetailsTestCase):
    method = "put"

    def test_simple(self):
        data_sources = [
            {
                "name": "knownUsersAffectedQuery_2",
                "data": self.known_users_query,
                "type": "discover_saved_search",
                "order": 1,
            },
            {
                "name": "anonymousUsersAffectedQuery_2",
                "data": self.anon_users_query,
                "type": "discover_saved_search",
                "order": 2,
            },
        ]
        response = self.get_response(
            self.organization.slug,
            self.dashboard.id,
            self.widget.id,
            displayType="line",
            title="User Happiness",
            dataSources=data_sources,
        )

        assert response.status_code == 200

        self.assert_widget_data(
            response.data,
            order="1",
            title="User Happiness",
            display_type="line",
            data_sources=data_sources,
        )

        widgets = Widget.objects.filter(dashboard_id=self.dashboard.id)
        assert len(widgets) == 1

        self.assert_widget(
            widgets[0],
            order=1,
            title="User Happiness",
            display_type=WidgetDisplayTypes.LINE_CHART,
            data_sources=data_sources,
        )

    def test_widget_no_data_souces(self):
        WidgetDataSource.objects.create(
            name="knownUsersAffectedQuery_2",
            data=self.known_users_query,
            type=WidgetDataSourceTypes.DISCOVER_SAVED_SEARCH,
            order=1,
            widget_id=self.widget.id,
        )
        response = self.get_response(
            self.organization.slug,
            self.dashboard.id,
            self.widget.id,
            displayType="line",
            title="User Happiness",
            dataSources=[],
        )
        assert response.status_code == 200
        self.assert_widget_data(
            response.data, order="1", title="User Happiness", display_type="line"
        )

        widgets = Widget.objects.filter(dashboard_id=self.dashboard.id)
        assert len(widgets) == 1

        self.assert_widget(
            widgets[0], order=1, title="User Happiness", display_type=WidgetDisplayTypes.LINE_CHART
        )
        assert not WidgetDataSource.objects.filter(widget_id=widgets[0]).exists()

    def test_unrecognized_display_type(self):
        response = self.get_response(
            self.organization.slug,
            self.dashboard.id,
            self.widget.id,
            displayType="happy-face",
            title="User Happiness",
        )
        assert response.status_code == 400
        assert response.data == {"displayType": [u"Widget displayType happy-face not recognized."]}

    def test_unrecognized_data_source_type(self):
        response = self.get_response(
            self.organization.slug,
            self.dashboard.id,
            self.widget.id,
            title="User Happiness",
            displayType="line",
            dataSources=[
                {
                    "name": "knownUsersAffectedQuery_3",
                    "data": self.known_users_query,
                    "type": "not-real-type",
                    "order": 1,
                }
            ],
        )
        assert response.status_code == 400
        assert response.data == {
            "dataSources": {"type": ["Widget data source type not-real-type not recognized."]}
        }

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
        widget = Widget.objects.create(
            dashboard_id=dashboard.id,
            order=1,
            title="Widget 2",
            display_type=WidgetDisplayTypes.LINE_CHART,
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
        widget = Widget.objects.create(
            dashboard_id=dashboard.id,
            order=1,
            title="Widget 2",
            display_type=WidgetDisplayTypes.LINE_CHART,
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
        assert not Widget.objects.filter(id=widget_id).exists()
        assert not WidgetDataSource.objects.filter(widget_id=widget_id).exists()

    def test_simple(self):
        response = self.get_response(self.organization.slug, self.dashboard.id, self.widget.id)
        assert response.status_code == 204
        self.assert_deleted_widget(self.widget.id)

    def test_with_data_sources(self):
        WidgetDataSource.objects.create(
            widget_id=self.widget.id,
            name="Data source 1",
            data=self.known_users_query,
            type=WidgetDataSourceTypes.DISCOVER_SAVED_SEARCH,
            order=1,
        )
        WidgetDataSource.objects.create(
            widget_id=self.widget.id,
            name="Data source 2",
            data=self.known_users_query,
            type=WidgetDataSourceTypes.DISCOVER_SAVED_SEARCH,
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
        widget = Widget.objects.create(
            dashboard_id=dashboard.id,
            order=1,
            title="Widget 2",
            display_type=WidgetDisplayTypes.LINE_CHART,
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
        widget = Widget.objects.create(
            dashboard_id=dashboard.id,
            order=1,
            title="Widget 2",
            display_type=WidgetDisplayTypes.LINE_CHART,
        )
        response = self.get_response(
            self.organization.slug,
            dashboard.id,
            widget.id,
            displayType="line",
            title="Happy Widget 2",
        )
        assert response.status_code == 404
