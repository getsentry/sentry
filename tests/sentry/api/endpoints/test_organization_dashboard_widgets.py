from __future__ import absolute_import

import pytest

from sentry.models import DashboardWidget, DashboardWidgetQuery, DashboardWidgetDisplayTypes
from sentry.testutils import OrganizationDashboardWidgetTestCase


class OrganizationDashboardWidgetsPostTestCase(OrganizationDashboardWidgetTestCase):
    endpoint = "sentry-api-0-organization-dashboard-widgets"
    method = "post"

    def test_simple(self):
        queries = [
            self.known_users_query,
            self.anon_users_query,
        ]

        response = self.get_response(
            self.organization.slug,
            self.dashboard.id,
            displayType="line",
            title="User Happiness",
            queries=queries,
        )

        assert response.status_code == 201

        self.assert_widget_data(
            response.data, order="1", title="User Happiness", display_type="line", queries=queries,
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
        response = self.get_response(
            self.organization.slug,
            self.dashboard.id,
            displayType="line",
            title="User Happiness",
            queries=[],
        )
        assert response.status_code == 201
        self.assert_widget_data(
            response.data, order="1", title="User Happiness", display_type="line"
        )

        widgets = DashboardWidget.objects.filter(dashboard_id=self.dashboard.id)
        assert len(widgets) == 1

        self.assert_widget(
            widgets[0],
            order=1,
            title="User Happiness",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
        )
        assert not DashboardWidgetQuery.objects.filter(widget_id=widgets[0]).exists()

    def test_new_widgets_added_to_end_of_dashboard_order(self):
        widget_1 = DashboardWidget.objects.create(
            order=1,
            title="Like a room without a roof",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            dashboard_id=self.dashboard.id,
        )
        widget_2 = DashboardWidget.objects.create(
            order=2,
            title="Hello World",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            dashboard_id=self.dashboard.id,
        )
        response = self.get_response(
            self.organization.slug, self.dashboard.id, displayType="line", title="User Happiness"
        )
        assert response.status_code == 201
        self.assert_widget_data(
            response.data, order="3", title="User Happiness", display_type="line"
        )
        widgets = DashboardWidget.objects.filter(dashboard_id=self.dashboard.id)
        assert len(widgets) == 3

        self.assert_widget(
            widgets.exclude(id__in=[widget_1.id, widget_2.id])[0],
            order=3,
            title="User Happiness",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            queries=None,
        )

    def test_unrecognized_display_type(self):
        response = self.get_response(
            self.organization.slug,
            self.dashboard.id,
            displayType="happy-face",
            title="User Happiness",
        )
        assert response.status_code == 400
        assert response.data == {"displayType": [u"Widget displayType happy-face not recognized."]}

    @pytest.mark.xfail(reason="not implemented yet")
    def test_invalid_query_data(self):
        response = self.get_response(
            self.organization.slug,
            self.dashboard.id,
            displayType="line",
            title="User Happiness",
            queries=[
                {
                    "name": "User happiness",
                    "fields": ["count()"],
                    "conditions": "bad():()",
                    "interval": "1d",
                }
            ],
        )
        assert response.status_code == 400
        assert response.data == {"queries": {"conditions": ["Widget conditions are not valid"]}}
