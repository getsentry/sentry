from __future__ import absolute_import

from django.core.urlresolvers import reverse
from sentry.models import Dashboard, Widget, WidgetDataSource, WidgetDataSourceTypes, WidgetDisplayTypes
from sentry.testutils import APITestCase


class OrganizationDashboardDetailsTest(APITestCase):
    def setUp(self):
        super(OrganizationDashboardDetailsTest, self).setUp()
        self.login_as(self.user)
        self.dashboard = Dashboard.objects.create(
            title='Dashboard 1',
            owner=self.user,
            organization=self.organization,
        )
        self.widget_1 = Widget.objects.create(
            dashboard=self.dashboard,
            order=1,
            title='Widget 1',
            display_type=WidgetDisplayTypes.LINE_CHART,
            organization=self.organization,
        )
        self.widget_2 = Widget.objects.create(
            dashboard=self.dashboard,
            order=2,
            title='Widget 2',
            display_type=WidgetDisplayTypes.TABLE,
            organization=self.organization,
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
        WidgetDataSource.objects.create(
            widget=self.widget_1,
            type=WidgetDataSourceTypes.DISCOVER_SAVED_SEARCH,
            name='anonymousUsersAffectedQuery',
            data=self.anon_users_query,
        )
        WidgetDataSource.objects.create(
            widget=self.widget_1,
            type=WidgetDataSourceTypes.DISCOVER_SAVED_SEARCH,
            name='knownUsersAffectedQuery',
            data=self.known_users_query,
        )
        WidgetDataSource.objects.create(
            widget=self.widget_2,
            type=WidgetDataSourceTypes.DISCOVER_SAVED_SEARCH,
            name='errorsByGeo',
            data=self.geo_erorrs_query,
        )

    def url(self, dashboard_id):
        return reverse(
            'sentry-api-0-organization-dashboard-details',
            kwargs={
                'organization_slug': self.organization.slug,
                'dashboard_id': dashboard_id,
            }
        )

    def assert_widget(self, widget, expected_widget):
        assert widget['id'] == expected_widget.id
        assert widget['title'] == expected_widget.title
        assert widget['display_type'] == expected_widget.display_type
        assert widget['data'] == expected_widget.data

    def test_get(self):
        response = self.client.get(self.url(self.dashboard.id))
        assert response.status_code == 200, response.content

        assert response.data['id'] == self.dashboard.id
        assert response.data['organization'] == self.dashboard.organization.slug
        assert response.data['title'] == self.dashboard.title
        assert response.data['owner'] == self.dashboard.owner.id
        assert response.data['data'] == self.dashboard.data

        assert len(response.data['widgets']) == 2
        widgets = sorted(response.data['widgets'], key=lambda x: x['id'])
        self.assert_widget(widgets[0], self.widget_1)
        self.assert_widget(widgets[1], self.widget_2)

    def test_put(self):
        response = self.client.put(
            self.url(self.dashboard.id),
            data={
                'title': 'Dashboard from Post',
                'data': {'data': 'data'},
                'owner': self.user.id,
                'organization': self.organization.id,
                'widgets':
                [
                    {
                        'order': 0,
                        'display_type': 'line-chart',
                        'title': 'User Happiness',
                        'data_sources': [
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
                        'display_type': 'table',
                        'title': 'Error Location',
                        'data_sources': [
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
        assert dashboard.owner == self.user

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
