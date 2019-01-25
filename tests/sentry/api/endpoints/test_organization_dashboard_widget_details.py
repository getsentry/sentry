from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Widget, WidgetDataSource, WidgetDisplayTypes
from sentry.testutils import OrganizationDashboardWidgetTestCase


class OrganizationDashboardWidgetDetailsTestCase(OrganizationDashboardWidgetTestCase):
    def setUp(self):
        super(OrganizationDashboardWidgetDetailsTestCase, self).setUp()
        self.widget = Widget.objects.create(
            dashboard_id=self.dashboard.id,
            order=1,
            title='Widget 1',
            display_type=WidgetDisplayTypes.LINE_CHART,
            display_options={},
        )

    def url(self, dashboard_id, widget_id):
        return reverse(
            'sentry-api-0-organization-dashboard-widget-details',
            kwargs={
                'organization_slug': self.organization.slug,
                'dashboard_id': dashboard_id,
                'widget_id': widget_id,
            }
        )


class OrganizationDashboardWidgetDetailsPutTestCase(OrganizationDashboardWidgetDetailsTestCase):
    def test_simple(self):
        data_sources = [
            {
                'name': 'knownUsersAffectedQuery_2',
                'data': self.known_users_query,
                'type': 'discover_saved_search',
                'order': 1,
            },
            {
                'name': 'anonymousUsersAffectedQuery_2',
                'data': self.anon_users_query,
                'type': 'discover_saved_search',
                'order': 2
            },
        ]
        response = self.client.put(
            self.url(self.dashboard.id, self.widget.id),
            data={
                'displayType': 'line',
                'title': 'User Happiness',
                'dataSources': data_sources,
            }
        )

        assert response.status_code == 200

        self.assert_widget_data(
            response.data,
            order='1',
            title='User Happiness',
            display_type='line',
            data_sources=data_sources,
        )

        widgets = Widget.objects.filter(
            dashboard_id=self.dashboard.id
        )
        assert len(widgets) == 1

        self.assert_widget(
            widgets[0],
            order=1,
            title='User Happiness',
            display_type=WidgetDisplayTypes.LINE_CHART,
            data_sources=data_sources,
        )

    def test_widget_no_data_souces(self):
        response = self.client.put(
            self.url(self.dashboard.id, self.widget.id),
            data={
                'displayType': 'line',
                'title': 'User Happiness',
            }
        )
        assert response.status_code == 200
        self.assert_widget_data(
            response.data,
            order='1',
            title='User Happiness',
            display_type='line',
        )

        widgets = Widget.objects.filter(
            dashboard_id=self.dashboard.id
        )
        assert len(widgets) == 1

        self.assert_widget(
            widgets[0],
            order=1,
            title='User Happiness',
            display_type=WidgetDisplayTypes.LINE_CHART,
        )
        assert not WidgetDataSource.objects.filter(
            widget_id=widgets[0],
        ).exists()

    def test_unrecognized_display_type(self):
        response = self.client.put(
            self.url(self.dashboard.id, self.widget.id),
            data={
                'displayType': 'happy-face',
                'title': 'User Happiness',
            }
        )
        assert response.status_code == 400
        assert response.data == {'displayType': [u'Widget display_type happy-face not recognized.']}

    def test_unrecognized_data_source_type(self):
        response = self.client.put(
            self.url(self.dashboard.id, self.widget.id),
            data={
                'displayType': 'line',
                'title': 'User Happiness',
                'dataSources': [{
                    'name': 'knownUsersAffectedQuery_2',
                    'data': self.known_users_query,
                    'type': 'not-real-type',
                    'order': 1,
                }],
            }
        )
        assert response.status_code == 400
        assert response.data == {'dataSources': [
            u'type: Widget data source type not-real-type not recognized.']}


class OrganizationDashboardWidgetsDeleteTestCase(OrganizationDashboardWidgetDetailsTestCase):
    pass
