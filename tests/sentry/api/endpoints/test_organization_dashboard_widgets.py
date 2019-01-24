from __future__ import absolute_import


from sentry.models import Dashboard, ObjectStatus, Widget, WidgetDataSource, WidgetDisplayTypes
from sentry.testutils import APITestCase


class OrganizationDashboardWidgetsPostTestCase(APITestCase):
    def setUp(self):
        super(OrganizationDashboardWidgetsPostTestCase, self).setUp()
        self.login_as(self.user)
        self.dashboard = Dashboard.objects.create(
            title='Dashboard 1',
            created_by=self.user,
            organization=self.organization,
        )

    def assert_widget(self, widget, order, title, display_type,
                      display_options=None, data_sources=None):
        assert widget.order == order
        assert widget.display_type == display_type
        if display_options:
            assert widget.display_options == display_options
        assert widget.title == title

        if not data_sources:
            return

        result_data_sources = sorted(
            WidgetDataSource.objects.filter(
                widget_id=widget.id,
                status=ObjectStatus.VISIBLE
            ),
            key=lambda x: x.id
        )
        data_sources.sort(lambda x: x['id'])
        for ds, expected_ds in zip(result_data_sources, data_sources):
            assert ds.name == expected_ds['name']
            assert ds.type == expected_ds['type']
            assert ds.order == expected_ds['order']
            assert ds.data == expected_ds['data']

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
        response = self.client.post(
            self.url(self.dashboard.id),
            data={
                'dashboard_id': self.dashboard.id,
                'displayType': 'line',
                'title': 'User Happiness',
                'dataSources': data_sources,
            }
        )
        assert response.status_code == 200
        widgets = Widget.objects.filter(
            dashboard_id=self.dashboard.id
        )
        assert len(widgets) == 1

        self.assert_widget(
            widgets[0],
            order=1,
            title='User Happiness',
            display_type=WidgetDisplayTypes.LINE,
            data_sources=data_sources,
        )

    def test_widget_no_data_souces(self):
        response = self.client.put(
            self.url(self.dashboard.id),
            data={
                'dashboard_id': self.dashboard.id,
                'displayType': 'line',
                'title': 'User Happiness',
                'dataSources': [],
            }
        )
        assert response.status_code == 200
        widgets = Widget.objects.filter(
            dashboard_id=self.dashboard.id
        )
        assert len(widgets) == 1

        self.assert_widget(
            widgets[0],
            order=1,
            title='User Happiness',
            display_type=WidgetDisplayTypes.LINE,
            data_sources=None,
        )
        assert not WidgetDataSource.objects.filter(
            widget_id=widgets[0],
        ).exists()

    def test_new_widgets_added_to_end_of_dashboard_order(self):
        widget_1 = Widget.objects.create(
            order=1,
            title='Like a room without a roof',
            display_type=WidgetDisplayTypes.LINE,
        )
        widget_2 = Widget.objects.create(
            order=2,
            title='Hello World',
            display_type=WidgetDisplayTypes.LINE,
        )
        response = self.client.put(
            self.url(self.dashboard.id),
            data={
                'dashboard_id': self.dashboard.id,
                'displayType': 'line',
                'title': 'User Happiness',
                'dataSources': [],
            }
        )
        assert response.status_code == 200
        widgets = Widget.objects.filter(
            dashboard_id=self.dashboard.id
        )
        assert len(widgets) == 3

        self.assert_widget(
            widgets.exclude(id__in=[widget_1.id, widget_2.id])[0],
            order=3,
            title='User Happiness',
            display_type=WidgetDisplayTypes.LINE,
            data_sources=None,
        )

    def test_unrecognized_display_type(self):
        response = self.client.put(
            self.url(self.dashboard.id),
            data={
                'dashboard_id': self.dashboard.id,
                'displayType': 'happy-face',
                'title': 'User Happiness',
                'dataSources': [],
            }
        )
        assert response.status_code == 400

    def test_unrecognized_data_source_type(self):
        response = self.client.put(
            self.url(self.dashboard.id),
            data={
                'dashboard_id': self.dashboard.id,
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
