from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from sentry.models import Dashboard, Widget, WidgetDataSource, WidgetDataSourceTypes, WidgetDisplayTypes
from sentry.testutils import APITestCase


class OrganizationDashboardDetailsTest(APITestCase):
    def setUp(self):
        super(OrganizationDashboardDetailsTest, self).setUp()
        self.login_as(self.user)
        self.dashboard = Dashboard.objects.create(
            title='Dashboard 1',
            created_by=self.user,
            organization=self.organization,
        )
        self.widget_1 = Widget.objects.create(
            dashboard=self.dashboard,
            order=1,
            title='Widget 1',
            display_type=WidgetDisplayTypes.LINE_CHART,
        )
        self.widget_2 = Widget.objects.create(
            dashboard=self.dashboard,
            order=2,
            title='Widget 2',
            display_type=WidgetDisplayTypes.TABLE,
        )
        self.anon_users_query = {
            'fields': [],
            'conditions': [['user.email', 'IS NULL', None]],
            'aggregations': [['count()', None, 'Anonymous Users']],
            'limit': 1000,
            'orderby': '-time',
            'groupby': ['time'],
            'rollup': 86400,
        }
        self.known_users_query = {
            'fields': [],
            'conditions': [['user.email', 'IS NOT NULL', None]],
            'aggregations': [['uniq', 'user.email', 'Known Users']],
            'limit': 1000,
            'orderby': '-time',
            'groupby': ['time'],
            'rollup': 86400,
        }
        self.geo_erorrs_query = {
            'fields': ['geo.country_code'],
            'conditions': [['geo.country_code', 'IS NOT NULL', None]],
            'aggregations': [['count()', None, 'count']],
            'limit': 10,
            'orderby': '-count',
            'groupby': ['geo.country_code'],
        }
        self.widget_1_data_1 = WidgetDataSource.objects.create(
            widget=self.widget_1,
            type=WidgetDataSourceTypes.DISCOVER_SAVED_SEARCH,
            name='anonymousUsersAffectedQuery',
            data=self.anon_users_query,
            order=1,
        )
        self.widget_1_data_2 = WidgetDataSource.objects.create(
            widget=self.widget_1,
            type=WidgetDataSourceTypes.DISCOVER_SAVED_SEARCH,
            name='knownUsersAffectedQuery',
            data=self.known_users_query,
            order=2,
        )
        self.widget_2_data_1 = WidgetDataSource.objects.create(
            widget=self.widget_2,
            type=WidgetDataSourceTypes.DISCOVER_SAVED_SEARCH,
            name='errorsByGeo',
            data=self.geo_erorrs_query,
            order=1,
        )

    def url(self, dashboard_id):
        return reverse(
            'sentry-api-0-organization-dashboard-details',
            kwargs={
                'organization_slug': self.organization.slug,
                'dashboard_id': dashboard_id,
            }
        )

    def assert_widget(self, data, expected_widget):
        assert data['id'] == six.text_type(expected_widget.id)
        assert data['title'] == expected_widget.title
        assert data['displayType'] == WidgetDisplayTypes.get_type_name(expected_widget.display_type)
        assert data['displayOptions'] == expected_widget.display_options

    def assert_dashboard(self, data, dashboard):
        assert data['id'] == six.text_type(dashboard.id)
        assert data['organization'] == six.text_type(dashboard.organization.id)
        assert data['title'] == dashboard.title
        assert data['createdBy'] == six.text_type(dashboard.created_by.id)

    def assert_widget_data_source(self, data, widget_data_source):
        assert data['id'] == six.text_type(widget_data_source.id)
        assert data['type'] == widget_data_source.type
        assert data['name'] == widget_data_source.name
        assert data['data'] == widget_data_source.data
        assert data['order'] == six.text_type(widget_data_source.order)

    def test_get(self):
        response = self.client.get(self.url(self.dashboard.id))
        assert response.status_code == 200, response.content

        self.assert_dashboard(response.data, self.dashboard)
        assert len(response.data['widgets']) == 2
        widgets = sorted(response.data['widgets'], key=lambda x: x['order'])
        self.assert_widget(widgets[0], self.widget_1)
        self.assert_widget(widgets[1], self.widget_2)

        widget_1_data_sources = sorted(widgets[0]['dataSources'], key=lambda x: x['order'])
        assert len(widget_1_data_sources) == 2
        self.assert_widget_data_source(widget_1_data_sources[0], self.widget_1_data_1)
        self.assert_widget_data_source(widget_1_data_sources[1], self.widget_1_data_2)

        assert len(widgets[1]['dataSources']) == 1
        self.assert_widget_data_source(widgets[1]['dataSources'][0], self.widget_2_data_1)

    def test_put(self):
        response = self.client.put(
            self.url(self.dashboard.id),
            data={
                'title': 'Dashboard from Post',
                'data': {'data': 'data'},
                'createdBy': self.user.id,
                'organization': self.organization.id,
                'widgets':
                [
                    {
                        'order': 0,
                        'displayType': 'line-chart',
                        'title': 'User Happiness',
                        'dataSources': [
                            {
                                'name': 'knownUsersAffectedQuery',
                                'data': self.known_users_query,
                                'type': 'disoversavedsearch',
                            },
                            {
                                'name': 'anonymousUsersAffectedQuery',
                                'data': self.anon_users_query,
                                'type': 'disoversavedsearch',
                            },

                        ]

                    },
                    {
                        'order': 1,
                        'displayType': 'table',
                        'title': 'Error Location',
                        'dataSources': [
                            {
                                'name': 'errorsByGeo',
                                'data': self.geo_erorrs_query,
                                'type': 'disoversavedsearch',
                            },
                        ]
                    }
                ]
            }
        )
        assert response.status_code == 201
        dashboard = Dashboard.objects.get(
            organization=self.organization,
            title='Dashboard from Post'
        )
        assert dashboard.data == {'data': 'data'}
        assert dashboard.created_by == self.user

        widgets = sorted(Widget.objects.filter(dashboard=dashboard), key=lambda w: w.order)
        assert len(widgets) == 2
        assert widgets[0].order == 0
        assert widgets[0].display_type == WidgetDisplayTypes.LINE_CHART
        assert widgets[0].title == 'User Happiness'

        assert widgets[1].order == 1
        assert widgets[1].display_type == WidgetDisplayTypes.TABLE
        assert widgets[1].title == 'Error Location'

        data_sources = sorted(
            WidgetDataSource.objects.filter(
                widget_id=widgets[0].id
            ),
            key=lambda d: d['name']
        )

        assert data_sources[0].name == 'anonymousUsersAffectedQuery'
        assert data_sources[0].data == self.anon_users_query
        assert data_sources[0].type == 'disoversavedsearch'

        assert data_sources[1].name == 'knownUsersAffectedQuery'
        assert data_sources[1].data == self.known_users_query
        assert data_sources[1].type == 'disoversavedsearch'

        data_sources = sorted(
            WidgetDataSource.objects.filter(
                widget_id=widgets[1].id
            ),
            key=lambda d: d['name']
        )
        assert data_sources[0].name == 'errorsByGeo'
        assert data_sources[0].data == self.geo_erorrs_query
        assert data_sources[0].type == 'disoversavedsearch'

    def test_delete(self):
        pass
