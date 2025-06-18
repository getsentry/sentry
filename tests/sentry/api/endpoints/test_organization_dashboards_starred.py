from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.models.dashboard import DashboardFavoriteUser
from sentry.testutils.cases import OrganizationDashboardWidgetTestCase


class OrganizationDashboardsStarredOrderTest(OrganizationDashboardWidgetTestCase):
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

    def create_dashboard_favorite(self, dashboard, user, organization, position):
        DashboardFavoriteUser.objects.create(
            dashboard=dashboard, user_id=user.id, organization=organization, position=position
        )

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
        with self.feature("organizations:dashboards-starred-reordering"):
            response = self.do_request(
                "put",
                self.url,
                data={
                    "dashboard_ids": [self.dashboard_3.id, self.dashboard_1.id, self.dashboard_2.id]
                },
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

        with self.feature("organizations:dashboards-starred-reordering"):
            response = self.do_request(
                "put",
                self.url,
                data={
                    "dashboard_ids": [self.dashboard_1.id, self.dashboard_1.id, self.dashboard_2.id]
                },
            )
        assert response.status_code == 400
        assert response.data == {
            "dashboard_ids": ["Single dashboard cannot take up multiple positions"]
        }

    def test_throws_an_error_if_reordered_dashboard_ids_are_not_complete(self):
        self.create_dashboard_favorite(self.dashboard_1, self.user, self.organization, 0)
        self.create_dashboard_favorite(self.dashboard_2, self.user, self.organization, 1)
        self.create_dashboard_favorite(self.dashboard_3, self.user, self.organization, 2)

        with self.feature("organizations:dashboards-starred-reordering"):
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

        with self.feature("organizations:dashboards-starred-reordering"):
            response = self.do_request(
                "put",
                self.url,
                data={
                    "dashboard_ids": [self.dashboard_3.id, self.dashboard_1.id, self.dashboard_2.id]
                },
            )
        assert response.status_code == 204

        assert list(
            DashboardFavoriteUser.objects.filter(
                organization=self.organization, user_id=self.user.id
            )
            .order_by("position")
            .values_list("dashboard_id", flat=True)
        ) == [self.dashboard_3.id, self.dashboard_1.id, self.dashboard_2.id]
