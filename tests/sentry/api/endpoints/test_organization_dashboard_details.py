from django.core.urlresolvers import reverse
from sentry.models import (
    Dashboard,
    DashboardTombstone,
    DashboardWidget,
    DashboardWidgetQuery,
    DashboardWidgetDisplayTypes,
)
from sentry.testutils import OrganizationDashboardWidgetTestCase
from sentry.utils.compat import zip


class OrganizationDashboardDetailsTestCase(OrganizationDashboardWidgetTestCase):
    def setUp(self):
        super().setUp()
        self.widget_1 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="Widget 1",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            interval="1d",
        )
        self.widget_2 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=1,
            title="Widget 2",
            display_type=DashboardWidgetDisplayTypes.TABLE,
            interval="1d",
        )
        self.widget_1_data_1 = DashboardWidgetQuery.objects.create(
            widget=self.widget_1,
            name=self.anon_users_query["name"],
            fields=self.anon_users_query["fields"],
            conditions=self.anon_users_query["conditions"],
            order=0,
        )
        self.widget_1_data_2 = DashboardWidgetQuery.objects.create(
            widget=self.widget_1,
            name=self.known_users_query["name"],
            fields=self.known_users_query["fields"],
            conditions=self.known_users_query["conditions"],
            order=1,
        )
        self.widget_2_data_1 = DashboardWidgetQuery.objects.create(
            widget=self.widget_2,
            name=self.geo_errors_query["name"],
            fields=self.geo_errors_query["fields"],
            conditions=self.geo_errors_query["conditions"],
            order=0,
        )

    def url(self, dashboard_id):
        return reverse(
            "sentry-api-0-organization-dashboard-details",
            kwargs={"organization_slug": self.organization.slug, "dashboard_id": dashboard_id},
        )

    def assert_serialized_dashboard(self, data, dashboard):
        assert data["id"] == str(dashboard.id)
        assert data["title"] == dashboard.title
        assert data["createdBy"] == str(dashboard.created_by.id)


class OrganizationDashboardDetailsGetTest(OrganizationDashboardDetailsTestCase):
    def test_get(self):
        response = self.client.get(self.url(self.dashboard.id))
        assert response.status_code == 200, response.content

        self.assert_serialized_dashboard(response.data, self.dashboard)
        assert len(response.data["widgets"]) == 2
        widgets = response.data["widgets"]
        self.assert_serialized_widget(widgets[0], self.widget_1)
        self.assert_serialized_widget(widgets[1], self.widget_2)

        widget_queries = widgets[0]["queries"]
        assert len(widget_queries) == 2
        self.assert_serialized_widget_query(widget_queries[0], self.widget_1_data_1)
        self.assert_serialized_widget_query(widget_queries[1], self.widget_1_data_2)

        assert len(widgets[1]["queries"]) == 1
        self.assert_serialized_widget_query(widgets[1]["queries"][0], self.widget_2_data_1)

    def test_dashboard_does_not_exist(self):
        response = self.client.get(self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_get_prebuilt_dashboard(self):
        # Pre-built dashboards should be accessible
        response = self.client.get(self.url("default-overview"))
        assert response.status_code == 200
        assert response.data["id"] == "default-overview"

    def test_get_prebuilt_dashboard_tombstoned(self):
        DashboardTombstone.objects.create(organization=self.organization, slug="default-overview")
        # Pre-built dashboards should be accessible even when tombstoned
        # This is to preserve behavior around bookmarks
        response = self.client.get(self.url("default-overview"))
        assert response.status_code == 200
        assert response.data["id"] == "default-overview"


class OrganizationDashboardDetailsDeleteTest(OrganizationDashboardDetailsTestCase):
    def test_delete(self):
        response = self.client.delete(self.url(self.dashboard.id))
        assert response.status_code == 204

        assert self.client.get(self.url(self.dashboard.id)).status_code == 404

        assert not Dashboard.objects.filter(id=self.dashboard.id).exists()
        assert not DashboardWidget.objects.filter(id=self.widget_1.id).exists()
        assert not DashboardWidget.objects.filter(id=self.widget_2.id).exists()
        assert not DashboardWidgetQuery.objects.filter(widget_id=self.widget_1.id).exists()
        assert not DashboardWidgetQuery.objects.filter(widget_id=self.widget_2.id).exists()

    def test_delete_permission(self):
        self.create_user_member_role()
        self.test_delete()

    def test_dashboard_does_not_exist(self):
        response = self.client.delete(self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_delete_prebuilt_dashboard(self):
        slug = "default-overview"
        response = self.client.delete(self.url(slug))
        assert response.status_code == 204
        assert DashboardTombstone.objects.filter(organization=self.organization, slug=slug).exists()


class OrganizationDashboardDetailsPutTest(OrganizationDashboardDetailsTestCase):
    def setUp(self):
        super().setUp()
        self.create_user_member_role()
        self.widget_3 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=2,
            title="Widget 3",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
        )
        self.widget_4 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=3,
            title="Widget 4",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
        )
        self.widget_ids = [self.widget_1.id, self.widget_2.id, self.widget_3.id, self.widget_4.id]

    def get_widget_queries(self, widget):
        return DashboardWidgetQuery.objects.filter(widget=widget).order_by("order")

    def assert_no_changes(self):
        self.assert_dashboard_and_widgets(self.widget_ids)

    def assert_dashboard_and_widgets(self, widget_ids):
        assert Dashboard.objects.filter(
            organization=self.organization, id=self.dashboard.id
        ).exists()

        widgets = self.get_widgets(self.dashboard)
        assert len(widgets) == len(list(widget_ids))

        for widget, id in zip(widgets, widget_ids):
            assert widget.id == id

    def test_dashboard_does_not_exist(self):
        response = self.client.put(self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_change_dashboard_title(self):
        response = self.client.put(self.url(self.dashboard.id), data={"title": "Dashboard Hello"})
        assert response.status_code == 200, response.data
        assert Dashboard.objects.filter(
            title="Dashboard Hello", organization=self.organization, id=self.dashboard.id
        ).exists()

    def test_rename_dashboard_title_taken(self):
        Dashboard.objects.create(
            title="Dashboard 2", created_by=self.user, organization=self.organization
        )
        response = self.client.put(self.url(self.dashboard.id), data={"title": "Dashboard 2"})
        assert response.status_code == 409, response.data
        assert list(response.data) == ["Dashboard with that title already exists."]

    def test_add_widget(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {"id": str(self.widget_2.id)},
                {"id": str(self.widget_3.id)},
                {"id": str(self.widget_4.id)},
                {
                    "title": "Error Counts by Country",
                    "displayType": "world_map",
                    "interval": "5m",
                    "queries": [
                        {"name": "Errors", "fields": ["count()"], "conditions": "event.type:error"}
                    ],
                },
                {
                    "title": "Errors over time",
                    "displayType": "line",
                    "interval": "5m",
                    "queries": [
                        {"name": "Errors", "fields": ["count()"], "conditions": "event.type:error"}
                    ],
                },
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 6

        last = list(widgets).pop()
        self.assert_serialized_widget(data["widgets"][5], last)

        queries = last.dashboardwidgetquery_set.all()
        assert len(queries) == 1
        self.assert_serialized_widget_query(data["widgets"][5]["queries"][0], queries[0])

    def test_add_widget_missing_title(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "displayType": "line",
                    "interval": "5m",
                    "queries": [{"name": "", "fields": ["count()"], "conditions": ""}],
                },
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Title is required during creation" in response.content

    def test_add_widget_display_type(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Errors",
                    "interval": "5m",
                    "queries": [{"name": "", "fields": ["count()"], "conditions": ""}],
                },
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"displayType is required during creation" in response.content

    def test_add_widget_invalid_query(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Invalid fields",
                    "displayType": "line",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["p95(transaction.duration)"],
                            "conditions": "foo: bar:",
                        }
                    ],
                },
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Invalid conditions" in response.content

    def test_add_widget_unknown_aggregation(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Invalid fields",
                    "displayType": "line",
                    "interval": "5m",
                    "queries": [{"name": "Errors", "fields": ["wrong()"], "conditions": ""}],
                },
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Invalid fields" in response.content

    def test_add_widget_invalid_aggregate_parameter(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Invalid fields",
                    "displayType": "line",
                    "queries": [{"name": "Errors", "fields": ["p95(user)"], "conditions": ""}],
                },
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Invalid fields" in response.content

    def test_add_widget_invalid_interval(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Invalid interval",
                    "displayType": "line",
                    "interval": "1q",
                    "queries": [
                        {
                            "name": "Durations",
                            "fields": ["p95(transaction.duration)"],
                            "conditions": "",
                        }
                    ],
                },
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Invalid interval" in response.content

    def test_update_widget_title(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id), "title": "New title"},
                {"id": str(self.widget_2.id)},
                {"id": str(self.widget_3.id)},
                {"id": str(self.widget_4.id)},
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 200

        widgets = self.get_widgets(self.dashboard.id)
        self.assert_serialized_widget(data["widgets"][0], widgets[0])

    def test_update_widget_add_query(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "title": "New title",
                    "queries": [
                        {"id": str(self.widget_1_data_1.id)},
                        {
                            "name": "transactions",
                            "fields": ["count()"],
                            "conditions": "event.type:transaction",
                        },
                    ],
                },
                {"id": str(self.widget_2.id)},
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        # two widgets should be removed
        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 2
        self.assert_serialized_widget(data["widgets"][0], widgets[0])

        queries = self.get_widget_queries(widgets[0])
        assert len(queries) == 2
        assert data["widgets"][0]["queries"][0]["id"] == str(queries[0].id)
        self.assert_serialized_widget_query(data["widgets"][0]["queries"][1], queries[1])

    def test_update_widget_remove_and_update_query(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "title": "New title",
                    "queries": [
                        {
                            "id": str(self.widget_1_data_1.id),
                            "name": "transactions",
                            "fields": ["count()"],
                            "conditions": "event.type:transaction",
                        },
                    ],
                },
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        # only one widget should remain
        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 1
        self.assert_serialized_widget(data["widgets"][0], widgets[0])

        queries = self.get_widget_queries(widgets[0])
        assert len(queries) == 1
        self.assert_serialized_widget_query(data["widgets"][0]["queries"][0], queries[0])

    def test_update_widget_reorder_queries(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "title": "New title",
                    "queries": [
                        {"id": str(self.widget_1_data_2.id)},
                        {"id": str(self.widget_1_data_1.id)},
                    ],
                },
                {"id": str(self.widget_2.id)},
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        # two widgets should be removed
        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 2

        queries = self.get_widget_queries(widgets[0])
        assert len(queries) == 2
        assert queries[0].id == self.widget_1_data_2.id
        assert queries[1].id == self.widget_1_data_1.id

    def test_update_widget_use_other_query(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "title": "New title",
                    "queries": [{"id": str(self.widget_2_data_1.id)}],
                },
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert "You cannot use a query not owned by this widget" in response.data

    def test_update_widget_invalid_orderby(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "queries": [
                        {
                            "fields": ["title", "count()"],
                            "conditions": "",
                            "orderby": "message",
                        }
                    ],
                },
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Cannot order by a field" in response.content

    def test_remove_widget_and_add_new(self):
        # Remove a widget from the middle of the set and put a new widget there
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {"id": str(self.widget_2.id)},
                {
                    "title": "Errors over time",
                    "displayType": "line",
                    "queries": [
                        {"name": "Errors", "fields": ["count()"], "conditions": "event.type:error"}
                    ],
                },
                {"id": str(self.widget_4.id)},
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 4
        # Check ordering
        assert self.widget_1.id == widgets[0].id
        assert self.widget_2.id == widgets[1].id
        self.assert_serialized_widget(data["widgets"][2], widgets[2])
        assert self.widget_4.id == widgets[3].id

    def test_update_widget_invalid_aggregate_parameter(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "title": "Invalid fields",
                    "displayType": "line",
                    "queries": [{"name": "Errors", "fields": ["p95(user)"], "conditions": ""}],
                },
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Invalid fields" in response.content

    def test_update_widget_invalid_fields(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "id": str(self.widget_1.id),
                    "title": "Invalid fields",
                    "displayType": "line",
                    "queries": [{"name": "Errors", "fields": ["p95()"], "conditions": "foo: bar:"}],
                },
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Invalid conditions" in response.content

    def test_remove_widgets(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id), "title": "New title"},
                {"id": str(self.widget_2.id), "title": "Other title"},
            ],
        }
        response = self.client.put(self.url(self.dashboard.id), data=data)
        assert response.status_code == 200

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 2
        self.assert_serialized_widget(data["widgets"][0], widgets[0])
        self.assert_serialized_widget(data["widgets"][1], widgets[1])

    def test_reorder_widgets(self):
        response = self.client.put(
            self.url(self.dashboard.id),
            data={
                "widgets": [
                    {"id": self.widget_3.id},
                    {"id": self.widget_2.id},
                    {"id": self.widget_1.id},
                    {"id": self.widget_4.id},
                ]
            },
        )
        assert response.status_code == 200, response.data
        self.assert_dashboard_and_widgets(
            [self.widget_3.id, self.widget_2.id, self.widget_1.id, self.widget_4.id]
        )

    def test_update_prebuilt_dashboard(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "New title",
                    "displayType": "line",
                    "queries": [
                        {
                            "name": "transactions",
                            "fields": ["count()"],
                            "conditions": "event.type:transaction",
                        },
                    ],
                },
            ],
        }
        slug = "default-overview"
        response = self.client.put(self.url(slug), data=data)
        assert response.status_code == 200, response.data
        dashboard_id = response.data["id"]
        assert dashboard_id != slug

        # Ensure widget and query were saved
        widgets = self.get_widgets(dashboard_id)
        assert len(widgets) == 1
        self.assert_serialized_widget(data["widgets"][0], widgets[0])

        queries = self.get_widget_queries(widgets[0])
        assert len(queries) == 1
        assert DashboardTombstone.objects.filter(slug=slug).exists()

    def test_update_unknown_prebuilt(self):
        data = {
            "title": "First dashboard",
        }
        slug = "nope-not-real"
        response = self.client.put(self.url(slug), data=data)
        assert response.status_code == 404

    def test_partial_reordering_deletes_widgets(self):
        response = self.client.put(
            self.url(self.dashboard.id),
            data={
                "title": "Changed the title",
                "widgets": [{"id": self.widget_3.id}, {"id": self.widget_4.id}],
            },
        )
        assert response.status_code == 200
        self.assert_dashboard_and_widgets([self.widget_3.id, self.widget_4.id])
        deleted_widget_ids = [self.widget_1.id, self.widget_2.id]
        assert not DashboardWidget.objects.filter(id__in=deleted_widget_ids).exists()
        assert not DashboardWidgetQuery.objects.filter(widget_id__in=deleted_widget_ids).exists()

    def test_widget_does_not_belong_to_dashboard(self):
        widget = DashboardWidget.objects.create(
            order=5,
            dashboard=Dashboard.objects.create(
                organization=self.organization, title="Dashboard 2", created_by=self.user
            ),
            title="Widget 200",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
        )
        response = self.client.put(
            self.url(self.dashboard.id),
            data={"widgets": [{"id": self.widget_4.id}, {"id": widget.id}]},
        )
        assert response.status_code == 400
        assert response.data == ["You cannot update widgets that are not part of this dashboard."]
        self.assert_no_changes()

    def test_widget_does_not_exist(self):
        response = self.client.put(
            self.url(self.dashboard.id),
            data={"widgets": [{"id": self.widget_4.id}, {"id": 1234567890}]},
        )
        assert response.status_code == 400
        assert response.data == ["You cannot update widgets that are not part of this dashboard."]
        self.assert_no_changes()
