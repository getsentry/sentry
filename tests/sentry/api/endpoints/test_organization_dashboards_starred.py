from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.models.dashboard import DashboardFavoriteUser
from sentry.testutils.cases import OrganizationDashboardWidgetTestCase


class StarredDashboardTestCase(OrganizationDashboardWidgetTestCase):
    def create_dashboard_favorite(self, dashboard, user, organization, position):
        DashboardFavoriteUser.objects.create(
            dashboard=dashboard, user_id=user.id, organization=organization, position=position
        )

    def do_request(self, *args, **kwargs):
        with self.feature("organizations:dashboards-starred-reordering"):
            return super().do_request(*args, **kwargs)


class OrganizationDashboardsStarredTest(StarredDashboardTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(
            "sentry-api-0-organization-dashboard-starred",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        self.dashboard_1 = self.create_dashboard(title="Dashboard 1")
        self.dashboard_2 = self.create_dashboard(title="Dashboard 2")
        self.dashboard_3 = self.create_dashboard(title="Dashboard 3")

    def test_get_favorite_dashboards(self):
        self.create_dashboard_favorite(self.dashboard_1, self.user, self.organization, 2)
        self.create_dashboard_favorite(self.dashboard_2, self.user, self.organization, 0)
        self.create_dashboard_favorite(self.dashboard_3, self.user, self.organization, 1)

        # Add a dashboard starred by another user to verify that it is not returned
        other_user = self.create_user("other@example.com")
        other_dashboard = self.create_dashboard(title="Other Dashboard")
        self.create_dashboard_favorite(other_dashboard, other_user, self.organization, 0)

        response = self.do_request("get", self.url)
        assert response.status_code == 200
        assert len(response.data) == 3
        assert [int(dashboard["id"]) for dashboard in response.data] == [
            self.dashboard_2.id,
            self.dashboard_3.id,
            self.dashboard_1.id,
        ]

    def test_get_request_assigns_positions_if_missing(self):
        self.create_dashboard_favorite(self.dashboard_1, self.user, self.organization, None)
        self.create_dashboard_favorite(self.dashboard_2, self.user, self.organization, 2)
        self.create_dashboard_favorite(self.dashboard_3, self.user, self.organization, None)

        response = self.do_request("get", self.url)
        assert response.status_code == 200
        assert len(response.data) == 3
        assert [int(dashboard["id"]) for dashboard in response.data] == [
            self.dashboard_2.id,
            self.dashboard_1.id,
            self.dashboard_3.id,
        ]

        assert (
            DashboardFavoriteUser.objects.get(
                organization=self.organization, user_id=self.user.id, dashboard=self.dashboard_1
            ).position
            == 1
        )
        assert (
            DashboardFavoriteUser.objects.get(
                organization=self.organization, user_id=self.user.id, dashboard=self.dashboard_3
            ).position
            == 2
        )

        # Positioned dashboards are at the top of the list in this operation
        assert (
            DashboardFavoriteUser.objects.get(
                organization=self.organization, user_id=self.user.id, dashboard=self.dashboard_2
            ).position
            == 0
        )


class OrganizationDashboardsStarredOrderTest(StarredDashboardTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(
            "sentry-api-0-organization-dashboard-starred-order",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        self.dashboard_1 = self.create_dashboard(title="Dashboard 1")
        self.dashboard_2 = self.create_dashboard(title="Dashboard 2")
        self.dashboard_3 = self.create_dashboard(title="Dashboard 3")

    def test_reorder_dashboards(self):
        self.create_dashboard_favorite(self.dashboard_1, self.user, self.organization, 0)
        self.create_dashboard_favorite(self.dashboard_2, self.user, self.organization, 1)
        self.create_dashboard_favorite(self.dashboard_3, self.user, self.organization, 2)

        assert list(
            DashboardFavoriteUser.objects.filter(
                organization=self.organization, user_id=self.user.id
            )
            .order_by("position")
            .values_list("dashboard_id", flat=True)
        ) == [
            self.dashboard_1.id,
            self.dashboard_2.id,
            self.dashboard_3.id,
        ]

        # Reorder the favorited dashboards
        response = self.do_request(
            "put",
            self.url,
            data={"dashboard_ids": [self.dashboard_3.id, self.dashboard_1.id, self.dashboard_2.id]},
        )
        assert response.status_code == 204

        assert list(
            DashboardFavoriteUser.objects.filter(
                organization=self.organization, user_id=self.user.id
            )
            .order_by("position")
            .values_list("dashboard_id", flat=True)
        ) == [
            self.dashboard_3.id,
            self.dashboard_1.id,
            self.dashboard_2.id,
        ]

    def test_throws_an_error_if_dashboard_ids_are_not_unique(self):
        self.create_dashboard_favorite(self.dashboard_1, self.user, self.organization, 0)
        self.create_dashboard_favorite(self.dashboard_2, self.user, self.organization, 1)
        self.create_dashboard_favorite(self.dashboard_3, self.user, self.organization, 2)

        response = self.do_request(
            "put",
            self.url,
            data={"dashboard_ids": [self.dashboard_1.id, self.dashboard_1.id, self.dashboard_2.id]},
        )
        assert response.status_code == 400
        assert response.data == {
            "dashboard_ids": ["Single dashboard cannot take up multiple positions"]
        }

    def test_throws_an_error_if_reordered_dashboard_ids_are_not_complete(self):
        self.create_dashboard_favorite(self.dashboard_1, self.user, self.organization, 0)
        self.create_dashboard_favorite(self.dashboard_2, self.user, self.organization, 1)
        self.create_dashboard_favorite(self.dashboard_3, self.user, self.organization, 2)

        response = self.do_request(
            "put",
            self.url,
            data={"dashboard_ids": [self.dashboard_1.id, self.dashboard_2.id]},
        )
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(
                string="Mismatch between existing and provided starred dashboards.",
                code="parse_error",
            )
        }

    def test_allows_reordering_even_if_no_initial_positions(self):
        self.create_dashboard_favorite(self.dashboard_1, self.user, self.organization, 0)
        self.create_dashboard_favorite(self.dashboard_2, self.user, self.organization, 1)
        self.create_dashboard_favorite(self.dashboard_3, self.user, self.organization, 2)

        response = self.do_request(
            "put",
            self.url,
            data={"dashboard_ids": [self.dashboard_3.id, self.dashboard_1.id, self.dashboard_2.id]},
        )
        assert response.status_code == 204

        assert list(
            DashboardFavoriteUser.objects.filter(
                organization=self.organization, user_id=self.user.id
            )
            .order_by("position")
            .values_list("dashboard_id", flat=True)
        ) == [self.dashboard_3.id, self.dashboard_1.id, self.dashboard_2.id]
