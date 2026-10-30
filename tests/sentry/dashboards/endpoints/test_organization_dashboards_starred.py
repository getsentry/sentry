from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.models.dashboard import DashboardFavoriteUser
from sentry.silo.base import SiloMode
from sentry.testutils.cases import OrganizationDashboardWidgetTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.roles import granular_roles_granting
from sentry.testutils.silo import assume_test_silo_mode


class StarredDashboardTestCase(OrganizationDashboardWidgetTestCase):
    def do_request(self, *args, **kwargs):
        with self.feature("organizations:dashboards-starred"):
            return super().do_request(*args, **kwargs)


class OrganizationDashboardsStarredTest(StarredDashboardTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(
            "sentry-api-0-organization-dashboard-starred",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        self.dashboard_1 = self.create_dashboard(title="Dashboard 1")
        self.dashboard_2 = self.create_dashboard(title="Dashboard 2")
        self.dashboard_3 = self.create_dashboard(title="Dashboard 3")

    def test_get_favorite_dashboards(self) -> None:
        self.create_dashboard_favorite_user(self.dashboard_1, self.user, self.organization, 2)
        self.create_dashboard_favorite_user(self.dashboard_2, self.user, self.organization, 0)
        self.create_dashboard_favorite_user(self.dashboard_3, self.user, self.organization, 1)

        response = self.do_request("get", self.url)
        assert response.status_code == 200
        assert len(response.data) == 3
        assert [int(dashboard["id"]) for dashboard in response.data] == [
            self.dashboard_2.id,
            self.dashboard_3.id,
            self.dashboard_1.id,
        ]

    def test_get_favorite_dashboards_only_returns_your_dashboards(self) -> None:
        self.create_dashboard_favorite_user(self.dashboard_1, self.user, self.organization, 1)

        # Add a dashboard starred by another user to verify that it is not returned
        other_user = self.create_user("other@example.com")
        other_dashboard = self.create_dashboard(title="Other Dashboard")
        self.create_dashboard_favorite_user(other_dashboard, other_user, self.organization, 0)

        response = self.do_request("get", self.url)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert int(response.data[0]["id"]) == self.dashboard_1.id

    def test_get_request_assigns_positions_if_missing(self) -> None:
        self.create_dashboard_favorite_user(self.dashboard_1, self.user, self.organization, None)
        self.create_dashboard_favorite_user(self.dashboard_2, self.user, self.organization, 2)
        self.create_dashboard_favorite_user(self.dashboard_3, self.user, self.organization, None)

        response = self.do_request("get", self.url)
        assert response.status_code == 200
        assert len(response.data) == 3

        # Positioned dashboards are at the top of the list in this operation
        assert (
            DashboardFavoriteUser.objects.get(
                organization=self.organization, user_id=self.user.id, dashboard=self.dashboard_2
            ).position
            == 0
        )
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


class OrganizationDashboardsStarredOrderTest(StarredDashboardTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(
            "sentry-api-0-organization-dashboard-starred-order",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        self.dashboard_1 = self.create_dashboard(title="Dashboard 1")
        self.dashboard_2 = self.create_dashboard(title="Dashboard 2")
        self.dashboard_3 = self.create_dashboard(title="Dashboard 3")

    def test_reorder_dashboards(self) -> None:
        self.create_dashboard_favorite_user(self.dashboard_1, self.user, self.organization, 0)
        self.create_dashboard_favorite_user(self.dashboard_2, self.user, self.organization, 1)
        self.create_dashboard_favorite_user(self.dashboard_3, self.user, self.organization, 2)

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

    def test_throws_an_error_if_dashboard_ids_are_not_unique(self) -> None:
        self.create_dashboard_favorite_user(self.dashboard_1, self.user, self.organization, 0)
        self.create_dashboard_favorite_user(self.dashboard_2, self.user, self.organization, 1)
        self.create_dashboard_favorite_user(self.dashboard_3, self.user, self.organization, 2)

        response = self.do_request(
            "put",
            self.url,
            data={"dashboard_ids": [self.dashboard_1.id, self.dashboard_1.id, self.dashboard_2.id]},
        )
        assert response.status_code == 400
        assert response.data == {
            "dashboard_ids": ["Single dashboard cannot take up multiple positions"]
        }

    def _starred_order(self) -> list[int]:
        return list(
            DashboardFavoriteUser.objects.filter(
                organization=self.organization, user_id=self.user.id
            )
            .order_by("position")
            .values_list("dashboard_id", flat=True)
        )

    def test_reorders_a_subset_of_dashboards(self) -> None:
        dashboard_4 = self.create_dashboard(title="Dashboard 4")
        self.create_dashboard_favorite_user(self.dashboard_1, self.user, self.organization, 0)
        self.create_dashboard_favorite_user(self.dashboard_2, self.user, self.organization, 1)
        self.create_dashboard_favorite_user(self.dashboard_3, self.user, self.organization, 2)
        self.create_dashboard_favorite_user(dashboard_4, self.user, self.organization, 3)

        # Swap dashboards 2 and 4; dashboards 1 and 3 keep their slots
        response = self.do_request(
            "put",
            self.url,
            data={"dashboard_ids": [dashboard_4.id, self.dashboard_2.id]},
        )
        assert response.status_code == 204
        assert self._starred_order() == [
            self.dashboard_1.id,
            dashboard_4.id,
            self.dashboard_3.id,
            self.dashboard_2.id,
        ]
        assert list(
            DashboardFavoriteUser.objects.filter(
                organization=self.organization, user_id=self.user.id
            )
            .order_by("position")
            .values_list("position", flat=True)
        ) == [0, 1, 2, 3]

    def test_reorders_a_contiguous_subset_of_dashboards(self) -> None:
        self.create_dashboard_favorite_user(self.dashboard_1, self.user, self.organization, 0)
        self.create_dashboard_favorite_user(self.dashboard_2, self.user, self.organization, 1)
        self.create_dashboard_favorite_user(self.dashboard_3, self.user, self.organization, 2)

        response = self.do_request(
            "put",
            self.url,
            data={"dashboard_ids": [self.dashboard_3.id, self.dashboard_2.id]},
        )
        assert response.status_code == 204
        assert self._starred_order() == [
            self.dashboard_1.id,
            self.dashboard_3.id,
            self.dashboard_2.id,
        ]

    def test_throws_an_error_if_dashboard_is_not_starred(self) -> None:
        self.create_dashboard_favorite_user(self.dashboard_1, self.user, self.organization, 0)
        self.create_dashboard_favorite_user(self.dashboard_2, self.user, self.organization, 1)

        response = self.do_request(
            "put",
            self.url,
            data={"dashboard_ids": [self.dashboard_3.id, self.dashboard_1.id]},
        )
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(
                string="Mismatch between existing and provided starred dashboards.",
                code="parse_error",
            )
        }
        assert self._starred_order() == [self.dashboard_1.id, self.dashboard_2.id]

    def test_allows_reordering_even_if_no_initial_positions(self) -> None:
        self.create_dashboard_favorite_user(self.dashboard_1, self.user, self.organization, None)
        self.create_dashboard_favorite_user(self.dashboard_2, self.user, self.organization, None)
        self.create_dashboard_favorite_user(self.dashboard_3, self.user, self.organization, None)

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


@with_feature("organizations:granular-permission-scopes")
@granular_roles_granting("user_preference:read", "user_preference:write")
class OrganizationDashboardsStarredScopeTest(StarredDashboardTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse(
            "sentry-api-0-organization-dashboard-starred",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        self.order_url = reverse(
            "sentry-api-0-organization-dashboard-starred-order",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        self.dashboard_1 = self.create_dashboard(title="Dashboard 1")
        self.dashboard_2 = self.create_dashboard(title="Dashboard 2")
        self.create_dashboard_favorite_user(self.dashboard_1, self.user, self.organization, 0)
        self.create_dashboard_favorite_user(self.dashboard_2, self.user, self.organization, 1)

    def _use_token(self, scope_list: list[str]) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()
            token = self.create_user_auth_token(user=self.user, scope_list=scope_list)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.token}")

    def test_read_scope_can_list_starred(self) -> None:
        self._use_token(["user_preference:read"])
        response = self.do_request("get", self.url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2

    def test_read_scope_cannot_reorder(self) -> None:
        self._use_token(["user_preference:read"])
        response = self.do_request(
            "put",
            self.order_url,
            data={"dashboard_ids": [self.dashboard_2.id, self.dashboard_1.id]},
        )
        assert response.status_code == 403

    def test_write_scope_can_reorder(self) -> None:
        self._use_token(["user_preference:write"])
        response = self.do_request(
            "put",
            self.order_url,
            data={"dashboard_ids": [self.dashboard_2.id, self.dashboard_1.id]},
        )
        assert response.status_code == 204, response.content

    def test_write_scope_cannot_list_starred(self) -> None:
        # Write does not imply read.
        self._use_token(["user_preference:write"])
        assert self.do_request("get", self.url).status_code == 403

    def test_dashboard_scopes_cannot_list_starred(self) -> None:
        # Starred dashboards are user preferences, not dashboard content.
        self._use_token(["dashboard:read", "dashboard:write"])
        assert self.do_request("get", self.url).status_code == 403
