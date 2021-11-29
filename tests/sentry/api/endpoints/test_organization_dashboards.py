from django.urls import reverse

from sentry.models import (
    Dashboard,
    DashboardTombstone,
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetTypes,
)
from sentry.testutils import OrganizationDashboardWidgetTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationDashboardsTest(OrganizationDashboardWidgetTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(
            "sentry-api-0-organization-dashboards",
            kwargs={"organization_slug": self.organization.slug},
        )
        self.dashboard_2 = Dashboard.objects.create(
            title="Dashboard 2", created_by=self.user, organization=self.organization
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
        assert data["createdBy"]["id"] == str(dashboard.created_by.id)

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

    def test_get_with_tombstone(self):
        DashboardTombstone.objects.create(organization=self.organization, slug="default-overview")
        response = self.do_request("get", self.url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        assert "default-overview" not in [r["id"] for r in response.data]

    def test_get_query(self):
        dashboard = Dashboard.objects.create(
            title="Dashboard 11", created_by=self.user, organization=self.organization
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
        Dashboard.objects.create(title="A", created_by=self.user, organization=self.organization)

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
            created_by=self.user,
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

            assert values == ["Dashboard"] + expected

    def test_get_sortby_recently_viewed(self):
        Dashboard.objects.create(
            title="A",
            created_by=self.user,
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

            assert values == ["Dashboard"] + expected

    def test_get_sortby_mydashboards(self):
        user_1 = self.create_user(username="user_1")
        self.create_member(organization=self.organization, user=user_1)

        user_2 = self.create_user(username="user_2")
        self.create_member(organization=self.organization, user=user_2)

        Dashboard.objects.create(title="A", created_by=user_1, organization=self.organization)
        Dashboard.objects.create(title="B", created_by=user_2, organization=self.organization)

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
            created_by=user_1,
            organization=self.organization,
            last_visited=before_now(minutes=5),
        )
        Dashboard.objects.create(
            title="Dashboard 4",
            created_by=user_2,
            organization=self.organization,
            last_visited=before_now(minutes=0),
        )
        Dashboard.objects.create(
            title="Dashboard 5",
            created_by=self.user,
            organization=self.organization,
            last_visited=before_now(minutes=5),
        )
        Dashboard.objects.create(
            title="Dashboard 6",
            created_by=self.user,
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
        assert dashboard.created_by == self.user

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
                            "conditions": "event.type:transaction",
                        }
                    ],
                },
                {
                    "displayType": "bar",
                    "interval": "5m",
                    "title": "Error count()",
                    "queries": [
                        {"name": "Errors", "fields": ["count()"], "conditions": "event.type:error"}
                    ],
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201, response.data
        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard from Post"
        )
        assert dashboard.created_by == self.user

        widgets = self.get_widgets(dashboard.id)
        assert len(widgets) == 2

        for expected_widget, actual_widget in zip(data["widgets"], widgets):
            self.assert_serialized_widget(expected_widget, actual_widget)

            queries = actual_widget.dashboardwidgetquery_set.all()
            for expected_query, actual_query in zip(expected_widget["queries"], queries):
                self.assert_serialized_widget_query(expected_query, actual_query)

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
