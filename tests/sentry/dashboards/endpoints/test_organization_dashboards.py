from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from unittest.mock import patch

from django.urls import reverse

from sentry.dashboards.endpoints.organization_dashboards import (
    PREBUILT_DASHBOARDS,
    PrebuiltDashboardId,
)
from sentry.models.dashboard import (
    Dashboard,
    DashboardFavoriteUser,
    DashboardLastVisited,
    DashboardTombstone,
)
from sentry.models.dashboard_widget import (
    DashboardWidget,
    DashboardWidgetDisplayTypes,
    DashboardWidgetTypes,
)
from sentry.models.organizationmember import OrganizationMember
from sentry.testutils.cases import OrganizationDashboardWidgetTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.options import override_options


class OrganizationDashboardsTest(OrganizationDashboardWidgetTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(
            "sentry-api-0-organization-dashboards",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        self.dashboard_2 = Dashboard.objects.create(
            title="Dashboard 2", created_by_id=self.user.id, organization=self.organization
        )
        DashboardWidget.objects.create(
            dashboard=self.dashboard_2,
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

        filters = dashboard.get_filters()
        if filters and filters.get("projects"):
            assert data.get("projects") == filters["projects"]

        assert "widgets" not in data

    def test_get(self) -> None:
        response = self.do_request("get", self.url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 3

        assert "default-overview" == response.data[0]["id"]
        self.assert_equal_dashboards(self.dashboard, response.data[1])
        self.assert_equal_dashboards(self.dashboard_2, response.data[2])

    def test_get_default_overview_has_widget_preview_field(self) -> None:
        response = self.do_request("get", self.url)
        assert response.status_code == 200, response.content
        assert "default-overview" == response.data[0]["id"]

        default_overview_data = Dashboard.get_prebuilt(
            self.organization, self.user, "default-overview"
        )
        default_overview = response.data[0]
        assert default_overview["widgetPreview"] == [
            {"displayType": w["displayType"], "layout": None}
            for w in default_overview_data["widgets"]
        ]

    def test_get_with_tombstone(self) -> None:
        DashboardTombstone.objects.create(organization=self.organization, slug="default-overview")
        response = self.do_request("get", self.url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2

        assert "default-overview" not in [r["id"] for r in response.data]

    def test_get_query(self) -> None:
        dashboard = Dashboard.objects.create(
            title="Dashboard 11", created_by_id=self.user.id, organization=self.organization
        )
        response = self.do_request("get", self.url, data={"query": "1"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        self.assert_equal_dashboards(self.dashboard, response.data[0])
        self.assert_equal_dashboards(dashboard, response.data[1])

    def test_get_query_no_results(self) -> None:
        response = self.do_request("get", self.url, data={"query": "not-in-there"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_get_sortby(self) -> None:
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

    def test_get_sortby_most_popular(self) -> None:
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

    def test_get_sortby_recently_viewed(self) -> None:
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

    def test_get_sortby_recently_viewed_user_last_visited(self) -> None:
        dashboard_a = Dashboard.objects.create(
            title="A",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        dashboard_b = Dashboard.objects.create(
            title="B",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        DashboardLastVisited.objects.create(
            dashboard=dashboard_a,
            member=OrganizationMember.objects.get(
                organization=self.organization, user_id=self.user.id
            ),
            last_visited=before_now(minutes=5),
        )
        DashboardLastVisited.objects.create(
            dashboard=dashboard_b,
            member=OrganizationMember.objects.get(
                organization=self.organization, user_id=self.user.id
            ),
            last_visited=before_now(minutes=0),
        )

        for forward_sort in [True, False]:
            sorting = "recentlyViewed" if forward_sort else "-recentlyViewed"

            with self.feature("organizations:dashboards-starred-reordering"):
                response = self.client.get(self.url, data={"sort": sorting})

            assert response.status_code == 200
            values = [row["title"] for row in response.data]
            expected = ["B", "A"]

            if not forward_sort:
                expected = list(reversed(expected))

            # Only A, B are sorted by their last visited entry, Dashboard 1
            # and Dashboard 2 are by default sorted by their date created
            assert values == ["General"] + expected + ["Dashboard 2", "Dashboard 1"]

    def test_get_sortby_mydashboards(self) -> None:
        user_1 = self.create_user(username="user_1")
        self.create_member(organization=self.organization, user=user_1)

        user_2 = self.create_user(username="user_2")
        self.create_member(organization=self.organization, user=user_2)

        Dashboard.objects.create(title="A", created_by_id=user_1.id, organization=self.organization)
        Dashboard.objects.create(title="B", created_by_id=user_2.id, organization=self.organization)

        response = self.client.get(self.url, data={"sort": "mydashboards"})
        assert response.status_code == 200, response.content

        values = [int(row["createdBy"]["id"]) for row in response.data if row["dateCreated"]]
        assert values == [self.user.id, self.user.id, user_2.id, user_1.id]

    def test_get_sortby_mydashboards_and_recently_viewed(self) -> None:
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

    def test_get_sortby_mydashboards_with_owner_name(self) -> None:
        user_1 = self.create_user(username="user_1", name="Cat")
        self.create_member(organization=self.organization, user=user_1)

        user_2 = self.create_user(username="user_2", name="Pineapple")
        self.create_member(organization=self.organization, user=user_2)

        user_3 = self.create_user(username="user_3", name="Banana")
        self.create_member(organization=self.organization, user=user_3)

        user_4 = self.create_user(username="user_4", name="Aapple")
        self.create_member(organization=self.organization, user=user_4)

        Dashboard.objects.create(title="A", created_by_id=user_1.id, organization=self.organization)
        Dashboard.objects.create(title="B", created_by_id=user_2.id, organization=self.organization)
        Dashboard.objects.create(title="C", created_by_id=user_3.id, organization=self.organization)
        Dashboard.objects.create(title="D", created_by_id=user_4.id, organization=self.organization)
        Dashboard.objects.create(title="E", created_by_id=user_2.id, organization=self.organization)
        Dashboard.objects.create(title="F", created_by_id=user_1.id, organization=self.organization)

        self.login_as(user_1)
        response = self.client.get(self.url, data={"sort": "mydashboards"})
        assert response.status_code == 200, response.content

        values = [row["createdBy"]["name"] for row in response.data if row["dateCreated"]]
        assert values == [
            "Cat",
            "Cat",
            "admin@localhost",  # name is empty
            "admin@localhost",
            "Aapple",
            "Banana",
            "Pineapple",
            "Pineapple",
        ]

        # descending
        response = self.client.get(self.url, data={"sort": "-mydashboards"})
        assert response.status_code == 200, response.content

        values = [row["createdBy"]["name"] for row in response.data if row["dateCreated"]]
        assert values == [
            "Cat",
            "Cat",
            "Pineapple",
            "Pineapple",
            "Banana",
            "Aapple",
            "admin@localhost",  # name is empty
            "admin@localhost",
        ]

    def test_get_only_favorites_no_sort(self) -> None:
        user_1 = self.create_user(username="user_1")
        self.create_member(organization=self.organization, user=user_1)
        user_2 = self.create_user(username="user_2")
        self.create_member(organization=self.organization, user=user_2)

        dashboard_4 = Dashboard.objects.create(
            title="Dashboard 4",
            created_by_id=user_2.id,
            organization=self.organization,
            last_visited=before_now(minutes=0),
        )
        dashboard_4.favorited_by = [user_1.id, user_2.id]
        dashboard_3 = Dashboard.objects.create(
            title="Dashboard 3",
            created_by_id=user_1.id,
            organization=self.organization,
            last_visited=before_now(minutes=5),
        )
        dashboard_3.favorited_by = [user_1.id]
        dashboard_5 = Dashboard.objects.create(
            title="Dashboard 5",
            created_by_id=self.user.id,
            organization=self.organization,
            last_visited=before_now(minutes=5),
        )
        dashboard_5.favorited_by = [user_1.id]
        dashboard_6 = Dashboard.objects.create(
            title="Dashboard 6",
            created_by_id=self.user.id,
            organization=self.organization,
            last_visited=before_now(minutes=0),
        )
        dashboard_6.favorited_by = [user_2.id]

        self.login_as(user_1)
        response = self.client.get(self.url, data={"filter": "onlyFavorites"})
        assert response.status_code == 200, response.content

        values = [row["title"] for row in response.data]
        # sorted by title by default
        assert values == ["Dashboard 3", "Dashboard 4", "Dashboard 5"]

    def test_get_only_favorites_with_sort(self) -> None:
        user_1 = self.create_user(username="user_1")
        self.create_member(organization=self.organization, user=user_1)
        user_2 = self.create_user(username="user_2")
        self.create_member(organization=self.organization, user=user_2)

        dashboard_4 = Dashboard.objects.create(
            title="Dashboard 4",
            created_by_id=user_2.id,
            organization=self.organization,
            last_visited=before_now(minutes=0),
        )
        dashboard_4.favorited_by = [user_1.id, user_2.id]
        dashboard_3 = Dashboard.objects.create(
            title="Dashboard 3",
            created_by_id=user_1.id,
            organization=self.organization,
            last_visited=before_now(minutes=5),
        )
        dashboard_3.favorited_by = [user_1.id]
        dashboard_5 = Dashboard.objects.create(
            title="Dashboard 5",
            created_by_id=self.user.id,
            organization=self.organization,
            last_visited=before_now(minutes=5),
        )
        dashboard_5.favorited_by = [user_1.id]
        dashboard_6 = Dashboard.objects.create(
            title="Dashboard 7",
            created_by_id=self.user.id,
            organization=self.organization,
            last_visited=before_now(minutes=0),
        )
        dashboard_6.favorited_by = [user_2.id]
        dashboard_7 = Dashboard.objects.create(
            title="Dashboard 6",
            created_by_id=self.user.id,
            organization=self.organization,
            last_visited=before_now(minutes=0),
        )
        dashboard_7.favorited_by = [user_2.id]

        self.login_as(user_1)
        response = self.client.get(
            self.url, data={"filter": "onlyFavorites", "sort": "dateCreated"}
        )
        assert response.status_code == 200, response.content

        values = [row["title"] for row in response.data]
        assert values == ["Dashboard 4", "Dashboard 3", "Dashboard 5"]

    def test_get_exclude_favorites_with_no_sort(self) -> None:
        user_1 = self.create_user(username="user_1")
        self.create_member(organization=self.organization, user=user_1)
        user_2 = self.create_user(username="user_2")
        self.create_member(organization=self.organization, user=user_2)

        dashboard_4 = Dashboard.objects.create(
            title="Dashboard 4",
            created_by_id=user_2.id,
            organization=self.organization,
            last_visited=before_now(minutes=0),
        )
        dashboard_4.favorited_by = [user_1.id, user_2.id]
        dashboard_3 = Dashboard.objects.create(
            title="Dashboard 3",
            created_by_id=user_1.id,
            organization=self.organization,
            last_visited=before_now(minutes=5),
        )
        dashboard_3.favorited_by = [user_1.id]
        dashboard_7 = Dashboard.objects.create(
            title="Dashboard 7",
            created_by_id=self.user.id,
            organization=self.organization,
            last_visited=before_now(minutes=0),
        )
        dashboard_7.favorited_by = [user_2.id]
        dashboard_5 = Dashboard.objects.create(
            title="Dashboard 5",
            created_by_id=self.user.id,
            organization=self.organization,
            last_visited=before_now(minutes=5),
        )
        dashboard_5.favorited_by = [user_1.id]
        dashboard_6 = Dashboard.objects.create(
            title="Dashboard 6",
            created_by_id=self.user.id,
            organization=self.organization,
            last_visited=before_now(minutes=0),
        )
        dashboard_6.favorited_by = [user_2.id]

        self.login_as(user_1)
        response = self.client.get(self.url, data={"filter": "excludeFavorites"})
        assert response.status_code == 200, response.content

        values = [row["title"] for row in response.data]
        # sorted by title by default
        assert values == ["General", "Dashboard 1", "Dashboard 2", "Dashboard 6", "Dashboard 7"]

    def test_get_exclude_favorites_with_sort(self) -> None:
        user_1 = self.create_user(username="user_1")
        self.create_member(organization=self.organization, user=user_1)
        user_2 = self.create_user(username="user_2")
        self.create_member(organization=self.organization, user=user_2)

        dashboard_4 = Dashboard.objects.create(
            title="Dashboard 4",
            created_by_id=user_2.id,
            organization=self.organization,
            last_visited=before_now(minutes=0),
        )
        dashboard_4.favorited_by = [user_1.id, user_2.id]
        dashboard_3 = Dashboard.objects.create(
            title="Dashboard 3",
            created_by_id=user_1.id,
            organization=self.organization,
            last_visited=before_now(minutes=5),
        )
        dashboard_3.favorited_by = [user_1.id]
        dashboard_7 = Dashboard.objects.create(
            title="Dashboard 7",
            created_by_id=self.user.id,
            organization=self.organization,
            last_visited=before_now(minutes=0),
        )
        dashboard_7.favorited_by = [user_2.id]
        dashboard_5 = Dashboard.objects.create(
            title="Dashboard 5",
            created_by_id=self.user.id,
            organization=self.organization,
            last_visited=before_now(minutes=5),
        )
        dashboard_5.favorited_by = [user_1.id]
        dashboard_6 = Dashboard.objects.create(
            title="Dashboard 6",
            created_by_id=self.user.id,
            organization=self.organization,
            last_visited=before_now(minutes=0),
        )
        dashboard_6.favorited_by = [user_2.id]

        self.login_as(user_1)
        response = self.client.get(
            self.url, data={"filter": "excludeFavorites", "sort": "dateCreated"}
        )
        assert response.status_code == 200, response.content

        values = [row["title"] for row in response.data]
        assert values == ["General", "Dashboard 1", "Dashboard 2", "Dashboard 7", "Dashboard 6"]

    def test_pin_favorites_with_my_dashboards_sort(self) -> None:
        user_1 = self.create_user(username="user_1")
        self.create_member(organization=self.organization, user=user_1)

        Dashboard.objects.create(
            title="Dashboard A",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        dashboard_B = Dashboard.objects.create(
            title="Dashboard B",
            created_by_id=user_1.id,
            organization=self.organization,
        )
        dashboard_C = Dashboard.objects.create(
            title="Dashboard C",
            created_by_id=user_1.id,
            organization=self.organization,
        )
        dashboard_D = Dashboard.objects.create(
            title="Dashboard D",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        dashboard_E = Dashboard.objects.create(
            title="Dashboard E",
            created_by_id=user_1.id,
            organization=self.organization,
        )

        dashboard_B.favorited_by = [self.user.id]
        dashboard_D.favorited_by = [self.user.id, user_1.id]
        dashboard_E.favorited_by = [self.user.id]
        dashboard_C.favorited_by = [user_1.id]

        response = self.client.get(self.url, data={"sort": "mydashboards", "pin": "favorites"})
        assert response.status_code == 200, response.content
        values = [row["title"] for row in response.data]
        assert values == [
            # favorites
            "Dashboard D",  # self.user's favorite
            "Dashboard E",  # user_1's dashboard
            "Dashboard B",  # user_1's dashboard
            # other dashboards
            "Dashboard A",  # self.user's dashboard
            "Dashboard 2",  # self.user's dashboard
            "Dashboard 1",  # self.user's dashboard
            "Dashboard C",  # user_1's dashbaord
        ]

    def test_pin_favorites_with_my_date_created_sort(self) -> None:
        user_1 = self.create_user(username="user_1")
        self.create_member(organization=self.organization, user=user_1)

        Dashboard.objects.create(
            title="Dashboard A",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        dashboard_B = Dashboard.objects.create(
            title="Dashboard B",
            created_by_id=user_1.id,
            organization=self.organization,
        )
        dashboard_C = Dashboard.objects.create(
            title="Dashboard C",
            created_by_id=user_1.id,
            organization=self.organization,
        )
        dashboard_D = Dashboard.objects.create(
            title="Dashboard D",
            created_by_id=self.user.id,
            organization=self.organization,
        )
        dashboard_E = Dashboard.objects.create(
            title="Dashboard E",
            created_by_id=user_1.id,
            organization=self.organization,
        )

        dashboard_B.favorited_by = [self.user.id, user_1.id]
        dashboard_D.favorited_by = [self.user.id]
        dashboard_E.favorited_by = [self.user.id]
        dashboard_C.favorited_by = [user_1.id]

        response = self.client.get(self.url, data={"sort": "dateCreated", "pin": "favorites"})
        assert response.status_code == 200, response.content
        values = [row["title"] for row in response.data]
        assert values == [
            # favorites
            "Dashboard B",
            "Dashboard D",
            "Dashboard E",
            # other dashboards
            "Dashboard 1",
            "Dashboard 2",
            "Dashboard A",
            "Dashboard C",
        ]

    def test_get_owned_dashboards(self) -> None:
        user_1 = self.create_user(username="user_1")
        self.create_member(organization=self.organization, user=user_1)
        user_2 = self.create_user(username="user_2")
        self.create_member(organization=self.organization, user=user_2)

        Dashboard.objects.create(
            title="Dashboard User 1",
            created_by_id=user_1.id,
            organization=self.organization,
        )
        Dashboard.objects.create(
            title="Dashboard User 2",
            created_by_id=user_2.id,
            organization=self.organization,
        )

        self.login_as(user_1)
        response = self.client.get(self.url, data={"filter": "owned"})
        assert response.status_code == 200, response.content
        values = [row["title"] for row in response.data]
        assert values == ["Dashboard User 1"]

        self.login_as(user_2)
        response = self.client.get(self.url, data={"filter": "owned"})
        assert response.status_code == 200, response.content
        values = [row["title"] for row in response.data]
        assert values == ["Dashboard User 2"]

    def test_get_owned_dashboards_across_organizations(self) -> None:
        user_1 = self.create_user(username="user_1")

        # The test user is a member of both orgs.
        other_org = self.create_organization(name="Other Org")
        self.create_member(organization=other_org, user=user_1)
        self.create_member(organization=self.organization, user=user_1)

        Dashboard.objects.create(
            title="Initial dashboard",
            created_by_id=user_1.id,
            organization=self.organization,
        )
        Dashboard.objects.create(
            title="Other org dashboard",
            created_by_id=user_1.id,
            organization=other_org,
        )

        self.login_as(user_1)
        response = self.client.get(self.url, data={"filter": "owned"})
        assert response.status_code == 200, response.content
        values = [row["title"] for row in response.data]
        assert values == ["Initial dashboard"]

    def test_get_owned_dashboards_can_pin_starred_at_top(self) -> None:
        user_1 = self.create_user(username="user_1")
        self.create_member(organization=self.organization, user=user_1)
        user_2 = self.create_user(username="user_2")
        self.create_member(organization=self.organization, user=user_2)

        Dashboard.objects.create(
            title="Dashboard User 1",
            created_by_id=user_1.id,
            organization=self.organization,
        )
        starred_dashboard = Dashboard.objects.create(
            title="Starred dashboard",
            created_by_id=user_1.id,
            organization=self.organization,
        )
        Dashboard.objects.create(
            title="Dashboard User 2",
            created_by_id=user_2.id,
            organization=self.organization,
        )

        # Add the starred dashboard to the user's favorites.
        DashboardFavoriteUser.objects.insert_favorite_dashboard(
            organization=self.organization,
            user_id=user_1.id,
            dashboard=starred_dashboard,
        )

        self.login_as(user_1)
        response = self.client.get(self.url, data={"filter": "owned", "pin": "favorites"})
        assert response.status_code == 200, response.content
        values = [row["title"] for row in response.data]
        assert values == ["Starred dashboard", "Dashboard User 1"]

    def test_get_shared_dashboards(self) -> None:
        user_1 = self.create_user(username="user_1")
        self.create_member(organization=self.organization, user=user_1)
        user_2 = self.create_user(username="user_2")
        self.create_member(organization=self.organization, user=user_2)

        # Clean up existing dashboards setup.
        Dashboard.objects.all().delete()

        Dashboard.objects.create(
            title="Dashboard User 1",
            created_by_id=user_1.id,
            organization=self.organization,
        )
        Dashboard.objects.create(
            title="Dashboard User 2",
            created_by_id=user_2.id,
            organization=self.organization,
        )

        self.login_as(user_1)
        response = self.client.get(self.url, data={"filter": "shared"})
        assert response.status_code == 200, response.content
        values = [row["title"] for row in response.data]
        assert values == ["General", "Dashboard User 2"]

        self.login_as(user_2)
        response = self.client.get(self.url, data={"filter": "shared"})
        assert response.status_code == 200, response.content
        values = [row["title"] for row in response.data]
        assert values == ["General", "Dashboard User 1"]

    def test_get_shared_dashboards_across_organizations(self) -> None:
        # The test user is a member of just the single org.
        test_user = self.create_user(username="user_1")
        self.create_member(organization=self.organization, user=test_user)

        # The other test user is a member of both orgs.
        other_user = self.create_user(username="other_user")
        other_org = self.create_organization(name="Other Org")
        self.create_member(organization=other_org, user=other_user)
        self.create_member(organization=self.organization, user=other_user)

        # Clean up existing dashboards setup.
        Dashboard.objects.all().delete()

        Dashboard.objects.create(
            title="Initial dashboard",
            created_by_id=other_user.id,
            organization=self.organization,
        )
        Dashboard.objects.create(
            title="Other org dashboard",
            created_by_id=other_user.id,
            organization=other_org,
        )

        self.login_as(test_user)
        response = self.client.get(self.url, data={"filter": "shared"})
        assert response.status_code == 200, response.content
        values = [row["title"] for row in response.data]
        assert values == ["General", "Initial dashboard"]

    def test_get_with_filters(self) -> None:
        Dashboard.objects.create(
            title="Dashboard with all projects filter",
            organization=self.organization,
            created_by_id=self.user.id,
            filters={"all_projects": True, "environment": ["alpha"], "release": ["v1"]},
        )
        response = self.client.get(self.url, data={"query": "Dashboard with all projects filter"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["title"] == "Dashboard with all projects filter"
        assert response.data[0].get("projects") == [-1]
        assert response.data[0].get("environment") == ["alpha"]
        assert response.data[0].get("filters") == {"release": ["v1"]}

    def test_get_with_last_visited(self) -> None:
        # Clean up existing dashboards setup for this test.
        Dashboard.objects.all().delete()

        Dashboard.objects.create(
            title="Dashboard without last visited",
            organization=self.organization,
            created_by_id=self.user.id,
        )
        dashboard_2 = Dashboard.objects.create(
            title="Dashboard with last visited",
            organization=self.organization,
            created_by_id=self.user.id,
        )
        now = before_now(minutes=0)
        DashboardLastVisited.objects.create(
            dashboard=dashboard_2,
            member=OrganizationMember.objects.get(
                organization=self.organization, user_id=self.user.id
            ),
            last_visited=now,
        )

        with self.feature("organizations:dashboards-starred-reordering"):
            response = self.client.get(self.url, data={"sort": "recentlyViewed"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 3

        titles = [row["title"] for row in response.data]
        assert titles == [
            "General",
            "Dashboard with last visited",
            "Dashboard without last visited",
        ]

        # Only "Dashboard with last visited" has a last visited timestamp.
        visited_at = [row.get("lastVisited") for row in response.data]
        assert visited_at == [None, now, None]

    def test_get_recently_viewed_sort_with_favorites_from_other_user(self) -> None:
        other_user = self.create_user(username="other_user")
        self.create_member(organization=self.organization, user=other_user)

        Dashboard.objects.all().delete()
        dashboard_1 = Dashboard.objects.create(
            title="Dashboard 1",
            created_by_id=other_user.id,
            organization=self.organization,
        )

        # Both users have the same dashboard in their favorites
        DashboardFavoriteUser.objects.insert_favorite_dashboard(
            organization=self.organization,
            user_id=self.user.id,
            dashboard=dashboard_1,
        )
        DashboardFavoriteUser.objects.insert_favorite_dashboard(
            organization=self.organization,
            user_id=other_user.id,
            dashboard=dashboard_1,
        )

        # Both users have recently visited the dashboard
        DashboardLastVisited.objects.create(
            dashboard=dashboard_1,
            member=OrganizationMember.objects.get(
                organization=self.organization, user_id=self.user.id
            ),
            last_visited=before_now(minutes=0),
        )
        DashboardLastVisited.objects.create(
            dashboard=dashboard_1,
            member=OrganizationMember.objects.get(
                organization=self.organization, user_id=other_user.id
            ),
            last_visited=before_now(minutes=2),
        )

        with self.feature("organizations:dashboards-starred-reordering"):
            response = self.client.get(
                self.url, data={"sort": "recentlyViewed", "pin": "favorites"}
            )
        assert response.status_code == 200, response.content

        # Assert that the dashboard did not receive a duplicate entry due to being
        # favorited by another user
        assert len(response.data) == 1
        self.assert_equal_dashboards(dashboard_1, response.data[0])

    def test_post(self) -> None:
        response = self.do_request("post", self.url, data={"title": "Dashboard from Post"})
        assert response.status_code == 201
        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard from Post"
        )
        assert dashboard.created_by_id == self.user.id

    def test_post_member_can_create(self) -> None:
        self.create_user_member_role()
        response = self.do_request("post", self.url, data={"title": "Dashboard from Post"})
        assert response.status_code == 201

    def test_post_features_required(self) -> None:
        with self.feature(
            {"organizations:dashboards-basic": False, "organizations:dashboards-edit": False}
        ):
            response = self.do_request(
                "post",
                self.url,
                data={"title": "Dashboard from Post"},
            )
            assert response.status_code == 404

    def test_post_with_widgets(self) -> None:
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

    def test_post_widget_with_camel_case_layout_keys_returns_camel_case(self) -> None:
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

    def test_post_widgets_with_null_layout_succeeds(self) -> None:
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

    def test_post_widgets_with_invalid_layout(self) -> None:
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

    def test_extra_keys_in_widget_layout_are_ignored(self) -> None:
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

    def test_post_widgets_with_valid_layout_keys_but_non_int_values(self) -> None:
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

    def test_post_errors_if_layout_submitted_without_required_keys(self) -> None:
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

    def test_post_dashboard_with_filters(self) -> None:
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

    def test_post_with_start_and_end_filter(self) -> None:
        start = (datetime.now() - timedelta(seconds=10)).isoformat()
        end = datetime.now().isoformat()
        response = self.do_request(
            "post",
            self.url,
            data={"title": "Dashboard from Post", "start": start, "end": end, "utc": True},
        )
        assert response.status_code == 201
        assert response.data["start"].replace(tzinfo=None).isoformat() == start
        assert response.data["end"].replace(tzinfo=None).isoformat() == end
        assert response.data["utc"]

    def test_post_with_start_and_end_filter_and_utc_false(self) -> None:
        start = (datetime.now() - timedelta(seconds=10)).isoformat()
        end = datetime.now().isoformat()
        response = self.do_request(
            "post",
            self.url,
            data={"title": "Dashboard from Post", "start": start, "end": end, "utc": False},
        )
        assert response.status_code == 201
        assert response.data["start"].replace(tzinfo=None).isoformat() == start
        assert response.data["end"].replace(tzinfo=None).isoformat() == end
        assert not response.data["utc"]

    def test_post_dashboard_with_invalid_project_filter(self) -> None:
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

    def test_post_dashboard_with_invalid_start_end_filter(self) -> None:
        start = datetime.now()
        end = datetime.now() - timedelta(seconds=10)
        response = self.do_request(
            "post",
            self.url,
            data={"title": "Dashboard from Post", "start": start, "end": end},
        )
        assert response.status_code == 400

    def test_add_widget_with_limit(self) -> None:
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

    def test_add_widget_with_invalid_limit_above_maximum(self) -> None:
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

    def test_add_widget_with_invalid_limit_below_minimum(self) -> None:
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

    def test_add_widget_with_field_aliases_succeeds(self) -> None:
        data: dict[str, Any] = {
            "title": "Dashboard with fieldAliases in the query",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": "Transaction count()",
                    "limit": 5,
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

    def test_post_widgets_with_columns_and_aggregates_succeeds(self) -> None:
        data: dict[str, Any] = {
            "title": "Dashboard with null agg and cols",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": "Transaction count()",
                    "limit": 5,
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

    def test_post_dashboard_with_greater_than_max_widgets_not_allowed(self) -> None:
        data = {
            "title": "Dashboard with way too many widgets",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": f"Widget {i}",
                    "limit": 5,
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

    def test_invalid_data(self) -> None:
        response = self.do_request("post", self.url, data={"malformed-data": "Dashboard from Post"})
        assert response.status_code == 400

    def test_integrity_error(self) -> None:
        response = self.do_request("post", self.url, data={"title": self.dashboard.title})
        assert response.status_code == 409
        assert response.data == "Dashboard title already taken"

    def test_duplicate_dashboard(self) -> None:
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

    def test_many_duplicate_dashboards(self) -> None:
        title = "My Awesome Dashboard"

        response = self.do_request(
            "post",
            self.url,
            data={"title": title, "duplicate": True},
        )

        assert response.status_code == 201, response.data
        assert response.data["title"] == "My Awesome Dashboard"

        response = self.do_request(
            "post",
            self.url,
            data={"title": title, "duplicate": True},
        )

        assert response.status_code == 201, response.data
        assert response.data["title"] == "My Awesome Dashboard copy"

        for i in range(1, 10):
            response = self.do_request(
                "post",
                self.url,
                data={"title": title, "duplicate": True},
            )

            assert response.status_code == 201, response.data
            assert response.data["title"] == f"My Awesome Dashboard copy {i}"

    def test_duplicate_a_duplicate(self) -> None:
        title = "An Amazing Dashboard copy 3"

        response = self.do_request(
            "post",
            self.url,
            data={"title": title, "duplicate": True},
        )

        assert response.status_code == 201, response.data
        assert response.data["title"] == "An Amazing Dashboard copy 3"

        response = self.do_request(
            "post",
            self.url,
            data={"title": title, "duplicate": True},
        )

        assert response.status_code == 201, response.data
        assert response.data["title"] == "An Amazing Dashboard copy 4"

    def test_widget_preview_field_returns_empty_list_if_no_widgets(self) -> None:
        response = self.do_request("get", self.url, data={"query": "1"})

        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        dashboard_data = response.data[0]
        assert "widgetPreview" in dashboard_data
        assert dashboard_data["widgetPreview"] == []

    def test_widget_preview_field_contains_display_type_and_layout(self) -> None:
        expected_layout = {"x": 1, "y": 0, "w": 1, "h": 1, "minH": 2}
        DashboardWidget.objects.create(
            dashboard=self.dashboard,
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

    def test_widget_preview_still_provides_display_type_if_no_layout(self) -> None:
        DashboardWidget.objects.create(
            dashboard=self.dashboard,
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

    def test_post_dashboard_with_widget_filter_requiring_environment(self) -> None:
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

    def test_post_dashboard_with_widget_split_datasets(self) -> None:
        mock_project = self.create_project()
        self.create_environment(project=mock_project, name="mock_env")
        data = {
            "title": "Dashboard",
            "widgets": [
                {
                    "title": "Errors per project",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["count()", "project"],
                            "columns": ["project"],
                            "aggregates": ["count()"],
                            "conditions": "event.type:error",
                        }
                    ],
                    "widgetType": "error-events",
                },
                {
                    "title": "Transaction Op Count",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Transaction Op Count",
                            "fields": ["count()", "transaction.op"],
                            "columns": ["transaction.op"],
                            "aggregates": ["count()"],
                            "conditions": "",
                        }
                    ],
                    "widgetType": "transaction-like",
                },
                {
                    "title": "Irrelevant widget type",
                    "displayType": "table",
                    "interval": "5m",
                    "queries": [
                        {
                            "name": "Issues",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "",
                        }
                    ],
                    "widgetType": "issue",
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201, response.data

        dashboard = Dashboard.objects.get(id=response.data["id"])
        widgets = dashboard.dashboardwidget_set.all()
        assert widgets[0].widget_type == DashboardWidgetTypes.get_id_for_type_name("error-events")
        assert widgets[0].discover_widget_split == DashboardWidgetTypes.get_id_for_type_name(
            "error-events"
        )

        assert widgets[1].widget_type == DashboardWidgetTypes.get_id_for_type_name(
            "transaction-like"
        )
        assert widgets[1].discover_widget_split == DashboardWidgetTypes.get_id_for_type_name(
            "transaction-like"
        )

        assert widgets[2].widget_type == DashboardWidgetTypes.get_id_for_type_name("issue")
        assert widgets[2].discover_widget_split is None

    def test_add_widget_with_selected_aggregate(self) -> None:
        data: dict[str, Any] = {
            "title": "First dashboard",
            "widgets": [
                {
                    "title": "EPM Big Number",
                    "displayType": "big_number",
                    "queries": [
                        {
                            "name": "",
                            "fields": ["epm()"],
                            "columns": [],
                            "aggregates": ["epm()", "count()"],
                            "conditions": "",
                            "orderby": "",
                            "selectedAggregate": 1,
                        }
                    ],
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201, response.data

        dashboard = Dashboard.objects.get(organization=self.organization, title="First dashboard")

        widgets = self.get_widgets(dashboard.id)
        assert len(widgets) == 1

        self.assert_serialized_widget(data["widgets"][0], widgets[0])

        queries = widgets[0].dashboardwidgetquery_set.all()
        assert len(queries) == 1
        self.assert_serialized_widget_query(data["widgets"][0]["queries"][0], queries[0])

    def test_create_new_edit_perms_with_teams(self) -> None:
        team1 = self.create_team(organization=self.organization)
        team2 = self.create_team(organization=self.organization)

        data = {
            "title": "New Dashboard 7",
            "permissions": {
                "isEditableByEveryone": "false",
                "teamsWithEditAccess": [str(team1.id), str(team2.id)],
            },
            "createdBy": {"id": "23516"},
            "id": "7136",
        }

        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201, response.content
        assert response.data["permissions"]["isEditableByEveryone"] is False
        assert response.data["permissions"]["teamsWithEditAccess"] == [team1.id, team2.id]

    def test_gets_dashboard_permissions_with_dashboard_list(self) -> None:
        response = self.do_request("get", self.url)
        assert response.status_code == 200, response.content
        assert len(response.data) > 1
        # Ensure the "permissions" field exists in each dashboard
        for dashboard in response.data:
            assert (
                "permissions" in dashboard
            ), f"Permissions field not found in dashboard: {dashboard}"
        self.assert_equal_dashboards(self.dashboard, response.data[1])
        assert response.data[1]["permissions"] is None

    def test_dasboard_list_permissions_is_valid(self) -> None:
        team1 = self.create_team(organization=self.organization)
        team2 = self.create_team(organization=self.organization)

        data = {
            "title": "New Dashboard 7",
            "permissions": {
                "isEditableByEveryone": "false",
                "teamsWithEditAccess": [str(team1.id), str(team2.id)],
            },
            "createdBy": {"id": "23516"},
            "id": "7136",
        }

        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201

        response = self.do_request("get", self.url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 4
        assert response.data[3]["permissions"]["isEditableByEveryone"] is False
        assert response.data[3]["permissions"]["teamsWithEditAccess"] == [team1.id, team2.id]

    def test_gets_dashboard_favorited_with_dashboard_list(self) -> None:
        self.dashboard.favorited_by = [self.user.id]

        response = self.do_request("get", self.url)
        assert response.status_code == 200, response.content

        for dashboard in response.data:
            assert "isFavorited" in dashboard
        self.assert_equal_dashboards(self.dashboard, response.data[1])
        assert response.data[1]["isFavorited"] is True
        assert response.data[0]["isFavorited"] is False  # general template
        assert response.data[2]["isFavorited"] is False  # dashboard_2 w/ no favorites set

    def test_post_errors_widget_with_is_filter(self) -> None:
        data: dict[str, Any] = {
            "title": "Dashboard with errors widget",
            "widgets": [
                {
                    "displayType": "line",
                    "interval": "5m",
                    "title": "Errors",
                    "limit": 5,
                    "queries": [
                        {
                            "name": "Errors",
                            "fields": ["count()"],
                            "columns": [],
                            "aggregates": ["count()"],
                            "conditions": "is:unresolved",
                        }
                    ],
                    "layout": {"x": 0, "y": 0, "w": 1, "h": 1, "minH": 2},
                    "widgetType": "error-events",
                },
            ],
        }
        response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201, response.data
        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard with errors widget"
        )
        assert dashboard.created_by_id == self.user.id

        widgets = self.get_widgets(dashboard.id)
        assert len(widgets) == 1

        self.assert_serialized_widget(data["widgets"][0], widgets[0])
        queries = widgets[0].dashboardwidgetquery_set.all()
        assert len(queries) == 1
        self.assert_serialized_widget_query(data["widgets"][0]["queries"][0], queries[0])

    def test_response_includes_project_ids(self) -> None:
        project = self.create_project()
        self.dashboard.projects.add(project)
        self.dashboard.save()

        response = self.do_request("get", self.url)
        assert response.status_code == 200, response.content

        overview_dashboard = response.data[0]
        assert overview_dashboard["projects"] == []

        current_dashboard = response.data[1]
        assert current_dashboard["projects"] == [project.id]

        starred_dashboard = response.data[2]
        assert starred_dashboard["projects"] == []

    def test_automatically_favorites_dashboard_when_isFavorited_is_true(self) -> None:
        data = {
            "title": "Dashboard with errors widget",
            "isFavorited": True,
        }
        with self.feature("organizations:dashboards-starred-reordering"):
            response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201, response.data
        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard with errors widget"
        )
        assert response.data["isFavorited"] is True

        assert (
            DashboardFavoriteUser.objects.get_favorite_dashboard(
                organization=self.organization, user_id=self.user.id, dashboard=dashboard
            )
            is not None
        )

    def test_does_not_automatically_favorite_dashboard_when_isFavorited_is_false(self) -> None:
        data = {
            "title": "Dashboard with errors widget",
            "isFavorited": False,
        }
        with self.feature("organizations:dashboards-starred-reordering"):
            response = self.do_request("post", self.url, data=data)
        assert response.status_code == 201, response.data
        dashboard = Dashboard.objects.get(
            organization=self.organization, title="Dashboard with errors widget"
        )
        assert response.data["isFavorited"] is False

        assert (
            DashboardFavoriteUser.objects.get_favorite_dashboard(
                organization=self.organization, user_id=self.user.id, dashboard=dashboard
            )
            is None
        )

    def test_order_by_most_favorited(self) -> None:
        Dashboard.objects.all().delete()

        # A mapping from dashboard title to the number of times it was favorited
        dashboards = {
            "Dashboard 1": 0,
            "Dashboard 2": 2,
            "Dashboard 3": 1,
        }

        # Set up a favorite entry for each dashboard by the number of times it was favorited
        for title, favorited in dashboards.items():
            dashboard = self.create_dashboard(title=title, organization=self.organization)
            if favorited:
                for _ in range(favorited):
                    user = self.create_user()
                    DashboardFavoriteUser.objects.create(
                        dashboard=dashboard,
                        user_id=user.id,
                        organization=self.organization,
                    )

        with self.feature("organizations:dashboards-starred-reordering"):
            response = self.do_request(
                "get", self.url, {"sort": "mostFavorited", "pin": "favorites"}
            )

        assert response.status_code == 200, response.content
        assert [dashboard["title"] for dashboard in response.data] == [
            "Dashboard 2",
            "Dashboard 3",
            "Dashboard 1",
        ]

    @patch("sentry.quotas.backend.get_dashboard_limit")
    def test_dashboard_limit_prevents_creation(self, mock_get_dashboard_limit) -> None:
        mock_get_dashboard_limit.return_value = 1
        response = self.do_request("post", self.url, data={"title": "New Dashboard w/ Limit"})
        assert response.status_code == 400
        assert response.data == "You may not exceed 1 dashboards on your current plan."

        mock_get_dashboard_limit.return_value = 5
        response = self.do_request("post", self.url, data={"title": "New Dashboard w/ Limit"})
        assert response.status_code == 201

    @patch("sentry.quotas.backend.get_dashboard_limit")
    def test_dashboard_limit_not_bypassed_by_burst_creates(self, mock_get_dashboard_limit) -> None:
        Dashboard.objects.all().delete()
        mock_get_dashboard_limit.return_value = 2

        responses = []
        for i in range(5):
            response = self.do_request("post", self.url, data={"title": f"Burst Request {i}"})
            responses.append(response)

        # Only up to the configured limit of dashboards should exist.
        dashboards = Dashboard.objects.filter(
            organization=self.organization,
            prebuilt_id=None,
        )
        assert dashboards.count() == 2

        # Only two requests should have successfully created a dashboard.
        created_response_count = sum(1 for response in responses if response.status_code == 201)
        assert created_response_count == 2

    @patch("sentry.quotas.backend.get_dashboard_limit")
    def test_dashboard_limit_does_not_count_prebuilt_dashboards(
        self, mock_get_dashboard_limit
    ) -> None:
        mock_get_dashboard_limit.return_value = 2

        Dashboard.objects.create(
            organization=self.organization,
            title="Prebuilt Dashboard 1",
            created_by_id=None,
            prebuilt_id=1,
        )
        Dashboard.objects.create(
            organization=self.organization,
            title="Prebuilt Dashboard 2",
            created_by_id=None,
            prebuilt_id=2,
        )

        # 2 prebuilt + 2 user dashboards
        response = self.do_request("post", self.url, data={"title": "Dashboard at Limit"})
        assert response.status_code == 400
        assert response.data == "You may not exceed 2 dashboards on your current plan."

        self.dashboard.delete()

        # 2 prebuilt + 1 user dashboard
        response = self.do_request("post", self.url, data={"title": "New Dashboard w/ Prebuilt"})
        assert response.status_code == 201

    def test_prebuilt_dashboard_is_shown_when_favorites_pinned_and_no_dashboards(self) -> None:
        # The prebuilt dashboard should not show up when filtering by owned dashboards
        # because it is not created by the user
        response = self.do_request("get", self.url, {"pin": "favorites", "filter": "owned"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert not any(
            dashboard["title"] == "General" and dashboard["id"] == "default-overview"
            for dashboard in response.data
        )

        # If there are no other dashboards when fetching with pinned dashboards
        # the prebuilt dashboard should show up
        response = self.do_request("get", self.url, {"pin": "favorites", "filter": "shared"})
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["title"] == "General"

    def test_endpoint_creates_prebuilt_dashboards_when_none_exist(self) -> None:
        prebuilt_count = Dashboard.objects.filter(
            organization=self.organization, prebuilt_id__isnull=False
        ).count()
        assert prebuilt_count == 0

        with self.feature("organizations:dashboards-prebuilt-insights-dashboards"):
            with override_options({"dashboards.prebuilt-dashboard-ids": [1, 2, 3]}):
                response = self.do_request("get", self.url)
        assert response.status_code == 200

        prebuilt_dashboards = Dashboard.objects.filter(
            organization=self.organization, prebuilt_id__isnull=False
        )
        assert prebuilt_dashboards.count() == 3

        for prebuilt_dashboard in PREBUILT_DASHBOARDS[:3]:
            dashboard = prebuilt_dashboards.get(prebuilt_id=prebuilt_dashboard["prebuilt_id"])
            assert dashboard.title == prebuilt_dashboard["title"]
            assert dashboard.organization == self.organization
            assert dashboard.created_by_id is None
            assert dashboard.prebuilt_id == prebuilt_dashboard["prebuilt_id"]

            matching_response_data = [
                d
                for d in response.data
                if "prebuiltId" in d and d["prebuiltId"] == prebuilt_dashboard["prebuilt_id"]
            ]
            assert len(matching_response_data) == 1

    def test_endpoint_does_not_create_duplicate_prebuilt_dashboards_when_exist(self) -> None:
        with self.feature("organizations:dashboards-prebuilt-insights-dashboards"):
            with override_options({"dashboards.prebuilt-dashboard-ids": [1, 2, 3]}):
                response = self.do_request("get", self.url)
            assert response.status_code == 200

        initial_count = Dashboard.objects.filter(
            organization=self.organization, prebuilt_id__isnull=False
        ).count()
        assert initial_count == 3

        with self.feature("organizations:dashboards-prebuilt-insights-dashboards"):
            with override_options({"dashboards.prebuilt-dashboard-ids": [1, 2, 3]}):
                response = self.do_request("get", self.url)
        assert response.status_code == 200

        final_count = Dashboard.objects.filter(
            organization=self.organization, prebuilt_id__isnull=False
        ).count()
        assert final_count == initial_count
        assert final_count == 3

    def test_endpoint_deletes_old_prebuilt_dashboards_not_in_list(self) -> None:
        old_prebuilt_id = 9999  # 9999 is not a valid prebuilt dashboard id
        old_dashboard = Dashboard.objects.create(
            organization=self.organization,
            title="Old Prebuilt Dashboard",
            created_by_id=None,
            prebuilt_id=old_prebuilt_id,
        )
        assert Dashboard.objects.filter(id=old_dashboard.id).exists()

        with self.feature("organizations:dashboards-prebuilt-insights-dashboards"):
            with override_options({"dashboards.prebuilt-dashboard-ids": [1, 2, 3]}):
                response = self.do_request("get", self.url)
        assert response.status_code == 200

        assert not Dashboard.objects.filter(id=old_dashboard.id).exists()

        prebuilt_dashboards = Dashboard.objects.filter(
            organization=self.organization, prebuilt_id__isnull=False
        )
        assert prebuilt_dashboards.count() == 3

    def test_endpoint_does_not_sync_without_feature_flag(self) -> None:
        prebuilt_count = Dashboard.objects.filter(
            organization=self.organization, prebuilt_id__isnull=False
        ).count()
        assert prebuilt_count == 0

        response = self.do_request("get", self.url)
        assert response.status_code == 200

        prebuilt_count = Dashboard.objects.filter(
            organization=self.organization, prebuilt_id__isnull=False
        ).count()
        assert prebuilt_count == 0

    def test_get_with_prebuilt_ids(self) -> None:
        with self.feature("organizations:dashboards-prebuilt-insights-dashboards"):
            with override_options({"dashboards.prebuilt-dashboard-ids": [1, 2, 3]}):
                response = self.do_request(
                    "get", self.url, {"prebuiltId": [PrebuiltDashboardId.FRONTEND_SESSION_HEALTH]}
                )
                assert response.status_code == 200
                assert len(response.data) == 1
                assert response.data[0]["prebuiltId"] == PrebuiltDashboardId.FRONTEND_SESSION_HEALTH
