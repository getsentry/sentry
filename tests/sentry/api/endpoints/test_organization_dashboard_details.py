from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from sentry.models import Dashboard, ObjectStatus, Widget, WidgetDataSource, WidgetDataSourceTypes, WidgetDisplayTypes
from sentry.testutils import APITestCase


class OrganizationDashboardDetailsTestCase(APITestCase):
    def setUp(self):
        super(OrganizationDashboardDetailsTestCase, self).setUp()
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
            'name': 'anonymousUsersAffectedQuery',
            'fields': [],
            'conditions': [['user.email', 'IS NULL', None]],
            'aggregations': [['count()', None, 'Anonymous Users']],
            'limit': 1000,
            'orderby': '-time',
            'groupby': ['time'],
            'rollup': 86400,
        }
        self.known_users_query = {
            'name': 'knownUsersAffectedQuery',
            'fields': [],
            'conditions': [['user.email', 'IS NOT NULL', None]],
            'aggregations': [['uniq', 'user.email', 'Known Users']],
            'limit': 1000,
            'orderby': '-time',
            'groupby': ['time'],
            'rollup': 86400,
        }
        self.geo_erorrs_query = {
            'name': 'errorsByGeo',
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

    def sort_by_order(self, widgets):
        def get_order(x):
            try:
                return x['order']
            except TypeError:
                return x.order

        return sorted(widgets, key=get_order)

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


class OrganizationDashboardDetailsGetTest(OrganizationDashboardDetailsTestCase):
    def test_get(self):
        response = self.client.get(self.url(self.dashboard.id))
        assert response.status_code == 200, response.content

        self.assert_dashboard(response.data, self.dashboard)
        assert len(response.data['widgets']) == 2
        widgets = self.sort_by_order(response.data['widgets'])
        self.assert_widget(widgets[0], self.widget_1)
        self.assert_widget(widgets[1], self.widget_2)

        widget_1_data_sources = self.sort_by_order(widgets[0]['dataSources'])
        assert len(widget_1_data_sources) == 2
        self.assert_widget_data_source(widget_1_data_sources[0], self.widget_1_data_1)
        self.assert_widget_data_source(widget_1_data_sources[1], self.widget_1_data_2)

        assert len(widgets[1]['dataSources']) == 1
        self.assert_widget_data_source(widgets[1]['dataSources'][0], self.widget_2_data_1)

    def test_dashboard_does_not_exist(self):
        response = self.client.get(self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {u'detail': 'The requested resource does not exist'}


class OrganizationDashboardDetailsDeleteTest(OrganizationDashboardDetailsTestCase):
    def test_delete(self):
        response = self.client.delete(self.url(self.dashboard.id))
        assert response.status_code == 204
        assert Dashboard.objects.get(id=self.dashboard.id).status == ObjectStatus.PENDING_DELETION

    def test_dashboard_does_not_exist(self):
        response = self.client.delete(self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {u'detail': 'The requested resource does not exist'}


class OrganizationDashboardDetailsPutTest(OrganizationDashboardDetailsTestCase):

    def test_put(self):
        response = self.client.put(
            self.url(self.dashboard.id),
            data={
                'title': 'Dashboard from Put',
                'createdBy': self.user.id,
                'organization': self.organization.id,
                'widgets':
                [
                    {
                        'order': 3,
                        'displayType': 'line',
                        'title': 'User Happiness',
                        'dataSources': [
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

                    },
                    {
                        'order': 4,
                        'displayType': 'table',
                        'title': 'Error Location',
                        'dataSources': [
                            {
                                'name': 'errorsByGeo_2',
                                'data': self.geo_erorrs_query,
                                'type': 'discover_saved_search',
                                'order': 1,
                            },
                        ]
                    }
                ]
            }
        )
        assert response.status_code == 200
        dashboard = Dashboard.objects.get(
            organization=self.organization,
            title='Dashboard from Put'
        )
        assert dashboard.created_by == self.user

        widgets = self.sort_by_order(Widget.objects.filter(dashboard=dashboard))
        assert len(widgets) == 4

        self.assert_widget(widgets[0], self.widget_1)
        self.assert_widget(widgets[1], self.widget_2)

        temp_widget = Widget(
            order=3, display_type=0, title='User Happiness',
        )
        self.assert_widget(widgets[2], temp_widget)

        temp_widget = Widget(
            order=4, display_type=5, title='Error Location',
        )
        self.assert_widget(widgets[3], temp_widget)

        data_sources = self.sort_by_order(
            WidgetDataSource.objects.filter(
                widget_id=widgets[0].id
            )
        )

        assert data_sources[0].name == 'anonymousUsersAffectedQuery_2'
        assert data_sources[0].data == self.anon_users_query
        assert data_sources[0].type == 'disoversavedsearch'

        assert data_sources[1].name == 'knownUsersAffectedQuery_2'
        assert data_sources[1].data == self.known_users_query
        assert data_sources[1].type == 'disoversavedsearch'

        data_sources = self.sort_by_order(
            WidgetDataSource.objects.filter(
                widget_id=widgets[1].id
            )
        )
        assert data_sources[0].name == 'errorsByGeo_2'
        assert data_sources[0].data == self.geo_erorrs_query
        assert data_sources[0].type == 'disoversavedsearch'

    def test_dashboard_no_widgets(self):
        Dashboard.objects.create(
            title='Dashboard 10101',
            created_by=self.user,
            organization=self.organization,
        )
        response = self.client.put(
            self.url(self.dashboard.id),
            data={'title': 'Dashboard Hello'}
        )
        assert response.status_code == 200
        assert Dashboard.objects.filter(
            title='Dashboard Hello',
            organizaiton=self.organization,
            created_by=self.user
        )

    def test_widget_no_data_souces(self):
        response = self.client.put(
            self.url(self.dashboard.id),
            data={
                'title': 'Dashboard from Put',
                'createdBy': self.user.id,
                'organization': self.organization.id,
                'widgets':
                [
                    {
                        'order': 3,
                        'displayType': 'line',
                        'title': 'User Happiness',
                        'dataSources': []
                    }
                ]
            }
        )
        assert response.status_code == 200

    def test_unrecognized_display_type(self):
        response = self.client.put(
            self.url(self.dashboard.id),
            data={
                'title': 'Dashboard from Put',
                'createdBy': self.user.id,
                'organization': self.organization.id,
                'widgets':
                [
                    {
                        'order': 3,
                        'displayType': 'happy-face',
                        'title': 'User Happiness',
                        'dataSources': []
                    }
                ]
            }
        )
        assert response.status_code == 400

    def test_unrecognized_data_source_type(self):
        response = self.client.put(
            self.url(self.dashboard.id),
            data={
                'title': 'Dashboard from Put',
                'createdBy': self.user.id,
                'organization': self.organization.id,
                'widgets':
                [
                    {
                        'order': 3,
                        'displayType': 'line',
                        'title': 'User Happiness',
                        'dataSources': [{
                            'name': 'knownUsersAffectedQuery_2',
                            'data': self.known_users_query,
                            'type': 'not-real-type',
                            'order': 1,
                        }],
                    }
                ]
            }
        )
        assert response.status_code == 400

    def test_dashboard_does_not_exist(self):
        response = self.client.put(self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {u'detail': u'Not found'}

    def test_invalid_dashboard(self):
        response = self.client.put(
            self.url(self.dashboard.id),
            data={
                'title': 'Dashboard from Put',
                'organization': self.organization.id,
                'widgets': [],
            }
        )
        assert response.status_code == 400
