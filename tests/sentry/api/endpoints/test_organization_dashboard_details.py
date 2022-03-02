from django.urls import reverse

from sentry.models import (
    Dashboard,
    DashboardTombstone,
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetQuery,
    DashboardWidgetTypes,
)
from sentry.testutils import OrganizationDashboardWidgetTestCase


class OrganizationDashboardDetailsTestCase(OrganizationDashboardWidgetTestCase):
    def setUp(self):
        super().setUp()
        self.widget_1 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="Widget 1",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2}},
        )
        self.widget_2 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=1,
            title="Widget 2",
            display_type=DashboardWidgetDisplayTypes.TABLE,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": {"x": 1, "y": 0, "w": 1, "h": 1, "minH": 2}},
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
        assert data["createdBy"]["id"] == str(dashboard.created_by.id)


class OrganizationDashboardDetailsGetTest(OrganizationDashboardDetailsTestCase):
    def test_get(self):
        response = self.do_request("get", self.url(self.dashboard.id))
        assert response.status_code == 200, response.content

        self.assert_serialized_dashboard(response.data, self.dashboard)
        assert len(response.data["widgets"]) == 2
        widgets = response.data["widgets"]
        assert "layout" in widgets[0]
        assert "layout" in widgets[1]
        self.assert_serialized_widget(widgets[0], self.widget_1)
        self.assert_serialized_widget(widgets[1], self.widget_2)

        widget_queries = widgets[0]["queries"]
        assert len(widget_queries) == 2
        self.assert_serialized_widget_query(widget_queries[0], self.widget_1_data_1)
        self.assert_serialized_widget_query(widget_queries[1], self.widget_1_data_2)

        assert len(widgets[1]["queries"]) == 1
        self.assert_serialized_widget_query(widgets[1]["queries"][0], self.widget_2_data_1)

    def test_dashboard_does_not_exist(self):
        response = self.do_request("get", self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_get_prebuilt_dashboard(self):
        # Pre-built dashboards should be accessible
        response = self.do_request("get", self.url("default-overview"))
        assert response.status_code == 200
        assert response.data["id"] == "default-overview"

    def test_get_prebuilt_dashboard_tombstoned(self):
        DashboardTombstone.objects.create(organization=self.organization, slug="default-overview")
        # Pre-built dashboards should be accessible even when tombstoned
        # This is to preserve behavior around bookmarks
        response = self.do_request("get", self.url("default-overview"))
        assert response.status_code == 200
        assert response.data["id"] == "default-overview"

    def test_features_required(self):
        with self.feature({"organizations:dashboards-basic": False}):
            response = self.do_request("get", self.url("default-overview"))
            assert response.status_code == 404


class OrganizationDashboardDetailsDeleteTest(OrganizationDashboardDetailsTestCase):
    def test_delete(self):
        response = self.do_request("delete", self.url(self.dashboard.id))
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
        response = self.do_request("delete", self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_delete_prebuilt_dashboard(self):
        slug = "default-overview"
        response = self.do_request("delete", self.url(slug))
        assert response.status_code == 204
        assert DashboardTombstone.objects.filter(organization=self.organization, slug=slug).exists()

    def test_delete_last_dashboard(self):
        slug = "default-overview"
        response = self.do_request("delete", self.url(slug))
        assert response.status_code == 204
        assert DashboardTombstone.objects.filter(organization=self.organization, slug=slug).exists()

        response = self.do_request("delete", self.url(self.dashboard.id))
        assert response.status_code == 409

    def test_delete_last_default_dashboard(self):
        response = self.do_request("delete", self.url(self.dashboard.id))
        assert response.status_code == 204
        assert self.client.get(self.url(self.dashboard.id)).status_code == 404

        slug = "default-overview"
        response = self.do_request("delete", self.url(slug))
        assert response.status_code == 409

    def test_features_required(self):
        with self.feature({"organizations:dashboards-edit": False}):
            response = self.do_request("delete", self.url("default-overview"))
            assert response.status_code == 404


class OrganizationDashboardDetailsPutTest(OrganizationDashboardDetailsTestCase):
    def setUp(self):
        super().setUp()
        self.create_user_member_role()
        self.widget_3 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=2,
            title="Widget 3",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
        )
        self.widget_4 = DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=3,
            title="Widget 4",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
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
        response = self.do_request("put", self.url(1234567890))
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_feature_required(self):
        with self.feature({"organizations:dashboards-edit": False}):
            response = self.do_request(
                "put", self.url(self.dashboard.id), data={"title": "Dashboard Hello"}
            )
            assert response.status_code == 404, response.data

    def test_change_dashboard_title(self):
        response = self.do_request(
            "put", self.url(self.dashboard.id), data={"title": "Dashboard Hello"}
        )
        assert response.status_code == 200, response.data
        assert Dashboard.objects.filter(
            title="Dashboard Hello", organization=self.organization, id=self.dashboard.id
        ).exists()

    def test_rename_dashboard_title_taken(self):
        Dashboard.objects.create(
            title="Dashboard 2", created_by=self.user, organization=self.organization
        )
        response = self.do_request(
            "put", self.url(self.dashboard.id), data={"title": "Dashboard 2"}
        )
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
                    "title": "Errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["count()", "project"],
                            "conditions": "event.type:error",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 6

        last = list(widgets).pop()
        self.assert_serialized_widget(data["widgets"][5], last)

        queries = last.dashboardwidgetquery_set.all()
        assert len(queries) == 1
        self.assert_serialized_widget_query(data["widgets"][5]["queries"][0], queries[0])

    def test_add_widget_with_aggregates_and_columns(self):
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
                        {
                            "name": "Errors",
                            "fields": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:error",
                        }
                    ],
                },
                {
                    "title": "Errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": [],
                            "aggregates": ["count()"],
                            "columns": ["project"],
                            "conditions": "event.type:error",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Cannot sort by a field" in response.content

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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
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
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200

        widgets = self.get_widgets(self.dashboard.id)
        assert len(widgets) == 2
        self.assert_serialized_widget(data["widgets"][0], widgets[0])
        self.assert_serialized_widget(data["widgets"][1], widgets[1])

    def test_reorder_widgets(self):
        response = self.do_request(
            "put",
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

    def test_update_widget_layouts(self):
        layouts = {
            self.widget_1.id: {"x": 0, "y": 0, "w": 2, "h": 5, "minH": 2},
            self.widget_2.id: {"x": 2, "y": 0, "w": 1, "h": 1, "minH": 2},
            self.widget_3.id: {"x": 3, "y": 0, "w": 2, "h": 2, "minH": 2},
            self.widget_4.id: {"x": 0, "y": 5, "w": 2, "h": 5, "minH": 2},
        }
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={
                "widgets": [
                    {"id": widget.id, "layout": layouts[widget.id]}
                    for widget in [self.widget_1, self.widget_2, self.widget_3, self.widget_4]
                ]
            },
        )
        assert response.status_code == 200, response.data
        widgets = response.data["widgets"]
        for widget in widgets:
            assert widget["layout"] == layouts[int(widget["id"])]

    def test_update_layout_with_invalid_data_fails(self):
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={
                "widgets": [
                    {
                        "id": self.widget_1.id,
                        "layout": {
                            "x": "this type is unexpected",
                            "y": 0,
                            "w": 2,
                            "h": 5,
                            "minH": 2,
                        },
                    }
                ]
            },
        )
        assert response.status_code == 400, response.data

    def test_update_without_specifying_layout_does_not_change_saved_layout(self):
        expected_layouts = {
            self.widget_1.id: {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2},
            self.widget_2.id: {"x": 1, "y": 0, "w": 1, "h": 1, "minH": 2},
            self.widget_3.id: None,
            self.widget_4.id: None,
        }
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={
                "widgets": [
                    {"id": widget.id}  # Not specifying layout for any widget
                    for widget in [self.widget_1, self.widget_2, self.widget_3, self.widget_4]
                ]
            },
        )
        assert response.status_code == 200, response.data
        widgets = response.data["widgets"]
        for widget in widgets:
            assert widget["layout"] == expected_layouts[int(widget["id"])]

    def test_ignores_certain_keys_in_layout(self):
        expected_layouts = {
            self.widget_1.id: {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2},
            self.widget_2.id: {"x": 1, "y": 0, "w": 1, "h": 1, "minH": 2},
        }
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={
                "widgets": [
                    {
                        "id": widget.id,
                        "layout": {
                            **expected_layouts[widget.id],
                            "i": "this-should-be-ignored",
                            "static": "don't want this",
                            "moved": False,
                        },
                    }
                    for widget in [self.widget_1, self.widget_2]
                ]
            },
        )
        assert response.status_code == 200, response.data
        widgets = response.data["widgets"]
        for widget in widgets:
            assert widget["layout"] == expected_layouts[int(widget["id"])]

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
        response = self.do_request("put", self.url(slug), data=data)
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
        response = self.do_request(
            "put",
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
            widget_type=DashboardWidgetTypes.DISCOVER,
        )
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={"widgets": [{"id": self.widget_4.id}, {"id": widget.id}]},
        )
        assert response.status_code == 400
        assert response.data == ["You cannot update widgets that are not part of this dashboard."]
        self.assert_no_changes()

    def test_widget_does_not_exist(self):
        response = self.do_request(
            "put",
            self.url(self.dashboard.id),
            data={"widgets": [{"id": self.widget_4.id}, {"id": 1234567890}]},
        )
        assert response.status_code == 400
        assert response.data == ["You cannot update widgets that are not part of this dashboard."]
        self.assert_no_changes()

    def test_add_issue_widget_valid_query(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Issues",
                    "displayType": "table",
                    "widgetType": "issue",
                    "interval": "5m",
                    "queries": [{"name": "", "fields": ["count()"], "conditions": "is:unresolved"}],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data

    def test_add_issue_widget_invalid_query(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Issues",
                    "displayType": "table",
                    "widgetType": "issue",
                    "interval": "5m",
                    "queries": [{"name": "", "fields": ["count()"], "conditions": "is:())"}],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Parse error" in response.content

    def test_add_discover_widget_invalid_issue_query(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Issues",
                    "displayType": "table",
                    "widgetType": "discover",
                    "interval": "5m",
                    "queries": [{"name": "", "fields": ["count()"], "conditions": "is:unresolved"}],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 400, response.data
        assert b"Invalid conditions" in response.content

    def test_add_multiple_discover_and_issue_widget(self):
        data = {
            "title": "First dashboard",
            "widgets": [
                {"id": str(self.widget_1.id)},
                {
                    "title": "Unresolved Issues",
                    "displayType": "table",
                    "widgetType": "issue",
                    "interval": "5m",
                    "queries": [{"name": "", "fields": ["count()"], "conditions": "is:unresolved"}],
                },
                {
                    "title": "Resolved Issues",
                    "displayType": "table",
                    "widgetType": "issue",
                    "interval": "5m",
                    "queries": [{"name": "", "fields": ["count()"], "conditions": "is:resolved"}],
                },
                {
                    "title": "Transactions",
                    "displayType": "table",
                    "widgetType": "discover",
                    "interval": "5m",
                    "queries": [
                        {"name": "", "fields": ["count()"], "conditions": "event.type:transaction"}
                    ],
                },
                {
                    "title": "Errors",
                    "displayType": "table",
                    "widgetType": "discover",
                    "interval": "5m",
                    "queries": [
                        {"name": "", "fields": ["count()"], "conditions": "event.type:error"}
                    ],
                },
            ],
        }
        response = self.do_request("put", self.url(self.dashboard.id), data=data)
        assert response.status_code == 200, response.data


class OrganizationDashboardVisitTest(OrganizationDashboardDetailsTestCase):
    def url(self, dashboard_id):
        return reverse(
            "sentry-api-0-organization-dashboard-visit",
            kwargs={"organization_slug": self.organization.slug, "dashboard_id": dashboard_id},
        )

    def test_visit_dashboard(self):
        last_visited = self.dashboard.last_visited
        assert self.dashboard.visits == 1

        response = self.do_request("post", self.url(self.dashboard.id))
        assert response.status_code == 204

        dashboard = Dashboard.objects.get(id=self.dashboard.id)
        assert dashboard.visits == 2
        assert dashboard.last_visited > last_visited

    def test_visit_dashboard_no_access(self):
        last_visited = self.dashboard.last_visited
        assert self.dashboard.visits == 1

        with self.feature({"organizations:dashboards-edit": False}):
            response = self.do_request("post", self.url(self.dashboard.id))

        assert response.status_code == 404

        dashboard = Dashboard.objects.get(id=self.dashboard.id)
        assert dashboard.visits == 1
        assert dashboard.last_visited == last_visited
