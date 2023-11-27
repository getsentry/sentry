from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from django.urls import reverse

from sentry.models.dashboard import Dashboard, DashboardTombstone
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetTypes,
)
from sentry.testutils.cases import OrganizationDashboardWidgetTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationDashboardsTest(OrganizationDashboardWidgetTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(
            "sentry-api-0-organization-dashboards",
            kwargs={"organization_slug": self.organization.slug},
        )
        self.dashboard_2 = Dashboard.objects.create(
            title="Dashboard 2", created_by_id=self.user.id, organization=self.organization
        )
        DashboardWidget.objects.create(
            dashboard=self.dashboard_2,
            order=0,
            title="Widget 1",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
        )

    def assert_equal_dashboards(self, dashboard, data):
        assert data["id"] == str(dashboard.id)
        assert data["title"] == dashboard.title
        assert data["createdBy"]["id"] == str(dashboard.created_by_id)

        widgets = self.get_widgets(dashboard.id)
        widget_displays = []
        for widget in widgets:
            widget_displays.append(DashboardWidgetDisplayTypes.get_type_name(widget.display_type))

        assert data["widgetDisplay"] == widget_displays
        assert "widgets" not in data

    def test_get(self):
        response = self.do_request("get", self.url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 3

        assert "default-overview" == response.data[0]["id"]
        self.assert_equal_dashboards(self.dashboard, response.data[1])
        self.assert_equal_dashboards(self.dashboard_2, response.data[2])

    def test_get_default_overview_has_widget_preview_field(self):
        response = self.do_request("get", self.url)
        assert response.status_code == 200, response.content
        assert "default-overview" == response.data[0]["id"]

        default_overview_data = Dashboard.get_prebuilt("default-overview")
        default_overview = response.data[0]
        assert default_overview["widgetPreview"] == [
            {"displayType": w["displayType"], "layout": None}
            for w in default_overview_data["widgets"]
        ]

    def test_get_with_tombstone(self):
        DashboardTombstone.objects.create(organization=self.organization, slug="default-overview")
        response = self.do_request("get", self.url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        assert "default-overview" not in [r["id"] for r in response.data]

    def test_get_query(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard 11", created_by_id=self.user.id, organization=self.organization
        )
        response = self.do_request("get", self.url, data={"query": "1"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        self.assert_equal_dashboards(self.dashboard, response.data[0])
        self.assert_equal_dashboards(dashboard, response.data[1])

    def test_get_query_no_results(self):
        response = self.do_request("get", self.url, data={"query": "not-in-there"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_get_sortby(self):
        Dashboard.objects.create(
            title="A", created_by_id=self.user.id, organization=self.organization
        )

        sort_options = {
            "dateCreated": True,
            "-dateCreated": False,
            "title": True,
            "-title": False,
        }
        for sorting, forward_sort in sort_options.items():
            response = self.client.get(self.url, data={"sort": sorting})
            assert response.status_code == 200

            # Ignoring the prebuilt query (date created is empty)
            values = [row[sorting.strip("-")] for row in response.data if row["dateCreated"]]
            if not forward_sort:
                values = list(reversed(values))
            assert list(sorted(values)) == values

    def test_get_sortby_most_popular(self):
        Dashboard.objects.create(
            title="A",
            created_by_id=self.user.id,
            organization=self.organization,
            visits=3,
            last_visited=before_now(minutes=5),
        )

        for forward_sort in [True, False]:
            sorting = "mostPopular" if forward_sort else "-mostPopular"
            response = self.client.get(self.url, data={"sort": sorting})

            assert response.status_code == 200
            values = [row["title"] for row in response.data]
            expected = ["A", "Dashboard 2", "Dashboard 1"]

            if not forward_sort:
                expected = ["Dashboard 2", "Dashboard 1", "A"]

            assert values == ["General"] + expected

    def test_get_sortby_recently_viewed(self):
        Dashboard.objects.create(
            title="A",
            created_by_id=self.user.id,
            organization=self.organization,
            visits=3,
            last_visited=before_now(minutes=5),
        )

        for forward_sort in [True, False]:
            sorting = "recentlyViewed" if forward_sort else "-recentlyViewed"
            response = self.client.get(self.url, data={"sort": sorting})

            assert response.status_code == 200
            values = [row["title"] for row in response.data]
            expected = ["Dashboard 2", "Dashboard 1", "A"]

            if not forward_sort:
                expected = list(reversed(expected))

            assert values == ["General"] + expected

    def test_get_sortby_mydashboards(self):
        user_1 = self.create_user(username="user_1")
        self.create_member(organization=self.organization, user=user_1)

        user_2 = self.create_user(username="user_2")
        self.create_member(organization=self.organization, user=user_2)

        Dashboard.objects.create(title="A", created_by_id=user_1.id, organization=self.organization)
        Dashboard.objects.create(title="B", created_by_id=user_2.id, organization=self.organization)

        response = self.client.get(self.url, data={"sort": "mydashboards"})
        assert response.status_code == 200, response.content

        values = [int(row["createdBy"]["id"]) for row in response.data if row["dateCreated"]]
        assert values == [self.user.id, self.user.id, user_1.id, user_2.id]

    def test_get_sortby_mydashboards_and_recently_viewed(self):
        user_1 = self.create_user(username="user_1")
        self.create_member(organization=self.organization, user=user_1)
        user_2 = self.create_user(username="user_2")
        self.create_member(organization=self.organization, user=user_2)

        Dashboard.objects.create(
            title="Dashboard 3",
            created_by_id=user_1.id,
            organization=self.organization,
            last_visited=before_now(minutes=5),
        )
        Dashboard.objects.create(
            title="Dashboard 4",
            created_by_id=user_2.id,
            organization=self.organization,
            last_visited=before_now(minutes=0),
        )
        Dashboard.objects.create(
            title="Dashboard 5",
            created_by_id=self.user.id,
            organization=self.organization,
            last_visited=before_now(minutes=5),
        )
        Dashboard.objects.create(
            title="Dashboard 6",
            created_by_id=self.user.id,
            organization=self.organization,
            last_visited=before_now(minutes=0),
        )

        response = self.client.get(self.url, data={"sort": "myDashboardsAndRecentlyViewed"})
        assert response.status_code == 200, response.content

        values = [row["title"] for row in response.data if row["dateCreated"]]
        assert values == [
            "Dashboard 6",
            "Dashboard 2",
            "Dashboard 1",
            "Dashboard 5",
            "Dashboard 4",
            "Dashboard 3",
        ]

    def test_post(self):
        response = self.do_request("post", self.url, data={"title": "Dashboard from Post"})
        assert response.status_code == 201
        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard from Post"
        )
        assert dashboard.created_by_id == self.user.id

    def test_post_member_can_create(self):
        self.create_user_member_role()
        response = self.do_request("post", self.url, data={"title": "Dashboard from Post"})
        assert response.status_code == 201

    def test_post_features_required(self):
        with self.feature(
            {"organizations:dashboards-basic": False, "organizations:dashboards-edit": False}
        ):
            response = self.do_request(
                "post",
                self.url,
                data={"title": "Dashboard from Post"},
            )
            assert response.status_code == 404

    def test_post_with_widgets(self):
        data: dict[str, Any] = {
            "title": "Dashboard from Post",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": "Transaction count()",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                    "layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2},
                },
                {
                    "displayType": "bar",
                    "interval": "5m",
                    "title": "Error count()",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:error",
                        }
                    ],
                    "layout": {"x": 1, "y": 0, "w": 1, "h": 1, "minH": 2},
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201, response.data
        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard from Post"
        )
        assert dashboard.created_by_id == self.user.id

        widgets = self.get_widgets(dashboard.id)
        assert len(widgets) == 2

        assert "layout" in data["widgets"][0]
        assert "layout" in data["widgets"][1]
        for expected_widget, actual_widget in zip(data["widgets"], widgets):
            self.assert_serialized_widget(expected_widget, actual_widget)

            queries = actual_widget.dashboardwidgetquery_set.all()
            for expected_query, actual_query in zip(expected_widget["queries"], queries):
                self.assert_serialized_widget_query(expected_query, actual_query)

    def test_post_widget_with_camel_case_layout_keys_returns_camel_case(self):
        data = {
            "title": "Dashboard from Post",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": "Transaction count()",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                    "layout": {"x": 0, "y": 0, "w": 2, "h": 2, "minH": 2},
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201, response.data
        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard from Post"
        )
        assert dashboard.created_by_id == self.user.id

        widgets = self.get_widgets(dashboard.id)
        assert len(widgets) == 1

        assert "layout" in data["widgets"][0]
        self.assert_serialized_widget(data["widgets"][0], widgets[0])

    def test_post_widgets_with_null_layout_succeeds(self):
        data: dict[str, Any] = {
            "title": "Dashboard from Post",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": "Transaction count()",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                    "layout": None,
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201, response.data
        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard from Post"
        )
        assert dashboard.created_by_id == self.user.id

        widgets = self.get_widgets(dashboard.id)
        assert len(widgets) == 1

        assert "layout" in data["widgets"][0]
        for expected_widget, actual_widget in zip(data["widgets"], widgets):
            self.assert_serialized_widget(expected_widget, actual_widget)

            queries = actual_widget.dashboardwidgetquery_set.all()
            for expected_query, actual_query in zip(expected_widget["queries"], queries):
                self.assert_serialized_widget_query(expected_query, actual_query)

    def test_post_widgets_with_invalid_layout(self):
        data = {
            "title": "Dashboard from Post",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": "Transaction count()",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                    "layout": {"x": False, "y": "this is incorrect", "w": 1, "h": 1, "minH": 2},
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 400, response.data

    def test_extra_keys_in_widget_layout_are_ignored(self):
        expected_widget: dict[str, Any] = {
            "displayType": "line",
            "interval": "5m",
            "title": "Transaction count()",
            "queries": [
                {
                    "name": "Transactions",
                    "fields": ["count()"],
                    "columns": [],
                    "aggregates": ["count()"],
                    "conditions": "event.type:transaction",
                }
            ],
            "layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2},
        }
        data: dict[str, Any] = {
            "title": "Dashboard from Post",
            "widgets": [
                {
                    **expected_widget,
                    "layout": {
                        **expected_widget["layout"],
                        "totally unexpected": "but ignored",
                        "no matter the type": True,
                    },
                }
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201, response.data
        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard from Post"
        )
        widgets = self.get_widgets(dashboard.id)

        assert len(widgets) == 1
        assert "layout" in data["widgets"][0]
        self.assert_serialized_widget(expected_widget, widgets[0])

    def test_post_widgets_with_valid_layout_keys_but_non_int_values(self):
        data = {
            "title": "Dashboard from Post",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": "Transaction count()",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                    "layout": {"x": "this", "y": "should", "w": "fail", "h": 1, "minH": 2},
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 400, response.data

    def test_post_errors_if_layout_submitted_without_required_keys(self):
        data = {
            "title": "Dashboard from Post",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": "Transaction count()",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                    "layout": {},
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 400, response.data

    def test_post_dashboard_with_filters(self):
        project1 = self.create_project(name="foo", organization=self.organization)
        project2 = self.create_project(name="bar", organization=self.organization)

        response = self.do_request(
            "post",
            self.url,
            data={
                "title": "Dashboard from Post",
                "projects": [project1.id, project2.id],
                "environment": ["alpha"],
                "period": "7d",
                "filters": {"release": ["v1"], "releaseId": ["1"]},
            },
        )
        assert response.status_code == 201
        assert response.data["projects"].sort() == [project1.id, project2.id].sort()
        assert response.data["environment"] == ["alpha"]
        assert response.data["period"] == "7d"
        assert response.data["filters"]["release"] == ["v1"]
        assert response.data["filters"]["releaseId"] == ["1"]

    def test_post_with_start_and_end_filter(self):
        start = iso_format(datetime.now() - timedelta(seconds=10))
        end = iso_format(datetime.now())
        response = self.do_request(
            "post",
            self.url,
            data={"title": "Dashboard from Post", "start": start, "end": end, "utc": True},
        )
        assert response.status_code == 201
        assert response.data["start"].strftime("%Y-%m-%dT%H:%M:%S") == start
        assert response.data["end"].strftime("%Y-%m-%dT%H:%M:%S") == end
        assert response.data["utc"]

    def test_post_with_start_and_end_filter_and_utc_false(self):
        start = iso_format(datetime.now() - timedelta(seconds=10))
        end = iso_format(datetime.now())
        response = self.do_request(
            "post",
            self.url,
            data={"title": "Dashboard from Post", "start": start, "end": end, "utc": False},
        )
        assert response.status_code == 201
        assert response.data["start"].strftime("%Y-%m-%dT%H:%M:%S") == start
        assert response.data["end"].strftime("%Y-%m-%dT%H:%M:%S") == end
        assert not response.data["utc"]

    def test_post_dashboard_with_invalid_project_filter(self):
        other_org = self.create_organization()
        other_project = self.create_project(name="other", organization=other_org)
        response = self.do_request(
            "post",
            self.url,
            data={
                "title": "Dashboard from Post",
                "projects": [other_project.id],
            },
        )
        assert response.status_code == 403

    def test_post_dashboard_with_invalid_start_end_filter(self):
        start = iso_format(datetime.now())
        end = iso_format(datetime.now() - timedelta(seconds=10))
        response = self.do_request(
            "post",
            self.url,
            data={"title": "Dashboard from Post", "start": start, "end": end},
        )
        assert response.status_code == 400

    def test_add_widget_with_limit(self):
        data = {
            "title": "Dashboard from Post",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "limit": 6,
                    "title": "Transaction count()",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
                {
                    "displayType": "bar",
                    "interval": "5m",
                    "limit": 5,
                    "title": "Error count()",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:error",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201, response.data
        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard from Post"
        )
        widgets = self.get_widgets(dashboard.id)

        self.assert_serialized_widget(data["widgets"][0], widgets[0])
        self.assert_serialized_widget(data["widgets"][1], widgets[1])

    def test_add_widget_with_invalid_limit_above_maximum(self):
        data = {
            "title": "Dashboard from Post",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "limit": 11,
                    "title": "Transaction count()",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 400
        assert b"Ensure this value is less than or equal to 10" in response.content

    def test_add_widget_with_invalid_limit_below_minimum(self):
        data = {
            "title": "Dashboard from Post",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "limit": 0,
                    "title": "Transaction count()",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 400
        assert b"Ensure this value is greater than or equal to 1" in response.content

    def test_add_widget_with_field_aliases_succeeds(self):
        data: dict[str, Any] = {
            "title": "Dashboard with fieldAliases in the query",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": "Transaction count()",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": ["transaction"],
                            "aggregates": ["count()"],
                            "fieldAliases": ["Count Alias"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201, response.data

        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard with fieldAliases in the query"
        )

        widgets = self.get_widgets(dashboard.id)
        assert len(widgets) == 1

        for expected_widget, actual_widget in zip(data["widgets"], widgets):
            self.assert_serialized_widget(expected_widget, actual_widget)
            queries = actual_widget.dashboardwidgetquery_set.all()
            for expected_query, actual_query in zip(expected_widget["queries"], queries):
                self.assert_serialized_widget_query(expected_query, actual_query)

    def test_post_widgets_with_columns_and_aggregates_succeeds(self):
        data: dict[str, Any] = {
            "title": "Dashboard with null agg and cols",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": "Transaction count()",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": ["transaction"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                    "layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2},
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201, response.data
        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard with null agg and cols"
        )
        assert dashboard.created_by_id == self.user.id

        widgets = self.get_widgets(dashboard.id)
        assert len(widgets) == 1

        for expected_widget, actual_widget in zip(data["widgets"], widgets):
            self.assert_serialized_widget(expected_widget, actual_widget)
            queries = actual_widget.dashboardwidgetquery_set.all()
            for expected_query, actual_query in zip(expected_widget["queries"], queries):
                self.assert_serialized_widget_query(expected_query, actual_query)

    def test_post_dashboard_with_greater_than_max_widgets_not_allowed(self):
        data = {
            "title": "Dashboard with way too many widgets",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": f"Widget {i}",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": ["transaction"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:transaction",
                        }
                    ],
                    "layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2},
                }
                for i in range(Dashboard.MAX_WIDGETS + 1)
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 400, response.data
        assert (
            f"Number of widgets must be less than {Dashboard.MAX_WIDGETS}"
            in response.content.decode()
        )

    def test_invalid_data(self):
        response = self.do_request("post", self.url, data={"malformed-data": "Dashboard from Post"})
        assert response.status_code == 400

    def test_integrity_error(self):
        response = self.do_request("post", self.url, data={"title": self.dashboard.title})
        assert response.status_code == 409
        assert response.data == "Dashboard title already taken"

    def test_duplicate_dashboard(self):
        response = self.do_request(
            "post",
            self.url,
            data={"title": self.dashboard.title, "duplicate": True},
        )
        assert response.status_code == 201, response.data
        assert response.data["title"] == f"{self.dashboard.title} copy"

        response = self.do_request(
            "post",
            self.url,
            data={"title": self.dashboard.title, "duplicate": True},
        )
        assert response.status_code == 201, response.data
        assert response.data["title"] == f"{self.dashboard.title} copy 1"

    def test_widget_preview_field_returns_empty_list_if_no_widgets(self):
        response = self.do_request("get", self.url, data={"query": "1"})

        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        dashboard_data = response.data[0]
        assert "widgetPreview" in dashboard_data
        assert dashboard_data["widgetPreview"] == []

    def test_widget_preview_field_contains_display_type_and_layout(self):
        expected_layout = {"x": 1, "y": 0, "w": 1, "h": 1, "minH": 2}
        DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="Widget 1",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
            detail={"layout": expected_layout},
        )
        response = self.do_request("get", self.url, data={"query": "1"})

        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        dashboard_data = response.data[0]
        assert "widgetPreview" in dashboard_data
        assert len(dashboard_data["widgetPreview"]) == 1

        widget_data = dashboard_data["widgetPreview"][0]
        assert widget_data["displayType"] == DashboardWidgetDisplayTypes.get_type_name(
            DashboardWidgetDisplayTypes.LINE_CHART
        )
        assert widget_data["layout"] == expected_layout

    def test_widget_preview_still_provides_display_type_if_no_layout(self):
        DashboardWidget.objects.create(
            dashboard=self.dashboard,
            order=0,
            title="Widget 1",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.DISCOVER,
            interval="1d",
        )
        response = self.do_request("get", self.url, data={"query": "1"})

        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        dashboard_data = response.data[0]
        assert "widgetPreview" in dashboard_data
        assert len(dashboard_data["widgetPreview"]) == 1

        widget_data = dashboard_data["widgetPreview"][0]
        assert widget_data["displayType"] == DashboardWidgetDisplayTypes.get_type_name(
            DashboardWidgetDisplayTypes.LINE_CHART
        )
        assert widget_data["layout"] is None

    def test_post_dashboard_with_widget_filter_requiring_environment(self):
        mock_project = self.create_project()
        self.create_environment(project=mock_project, name="mock_env")
        data = {
            "title": "Dashboard",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": "Widget",
                    "queries": [
                        {
                            "name": "Transactions",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "release.stage:adopted",
                        }
                    ],
                }
            ],
        }
        response = self.do_request("post", f"{self.url}?environment=mock_env", data=data)
        assert response.status_code == 201, response.data
