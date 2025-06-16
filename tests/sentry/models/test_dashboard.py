from sentry.models.dashboard import Dashboard, DashboardFavoriteUser
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase
from sentry.users.models.user import User


class IncrementalNameTest(TestCase):
    def test_no_conflict(self):
        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats"

    def test_one_preexisting(self):
        self.create_dashboard(title="Stats", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy"

    def test_two_consecutive_preexisting(self):
        self.create_dashboard(title="Stats", organization=self.organization)
        self.create_dashboard(title="Stats copy", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy 1"

    def test_two_preexisting_non_starting(self):
        self.create_dashboard(title="Stats copy 4", organization=self.organization)
        self.create_dashboard(title="Stats copy 5", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy 6"

    def test_two_preexisting_non_starting_non_consecutive(self):
        self.create_dashboard(title="Stats copy 4", organization=self.organization)
        self.create_dashboard(title="Stats copy 17", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy 18"

    def test_copy_of_copy(self):
        self.create_dashboard(title="Stats copy 4", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats copy 4") == "Stats copy 5"

    def test_name_with_copy_in_it(self):
        assert Dashboard.incremental_title(self.organization, "Stats copy 4") == "Stats copy 4"

    def test_similar_names(self):
        self.create_dashboard(title="Stats", organization=self.organization)
        self.create_dashboard(title="Statstististicks", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy"

    def test_similar_name_substring(self):
        self.create_dashboard(title="Statstististicks", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats"

    def test_across_organizations(self):
        first_organization = self.create_organization()
        second_organization = self.create_organization()

        self.create_dashboard(title="My Stuff", organization=first_organization)
        self.create_dashboard(title="My Stuff copy", organization=first_organization)
        self.create_dashboard(title="My Stuff copy 1", organization=first_organization)

        assert Dashboard.incremental_title(first_organization, "My Stuff") == "My Stuff copy 2"
        assert Dashboard.incremental_title(second_organization, "My Stuff") == "My Stuff"


class DashboardFavoriteUserTest(TestCase):
    def create_dashboard_favorite_user(
        self, dashboard: Dashboard, user: User, organization: Organization, position: int | None
    ):
        return DashboardFavoriteUser.objects.create(
            dashboard=dashboard, user_id=user.id, organization=organization, position=position
        )

    def test_inserts_to_last_position(self):
        for index, title in enumerate(["Existing Favorite", "Another Favorite"]):
            dashboard = self.create_dashboard(title=title, organization=self.organization)
            self.create_dashboard_favorite_user(dashboard, self.user, self.organization, index)

        new_dashboard = self.create_dashboard(title="New Dashboard", organization=self.organization)

        DashboardFavoriteUser.objects.insert_favorite_dashboard(
            self.organization, self.user.id, new_dashboard
        )

        new_favorite = DashboardFavoriteUser.objects.get_favorite_dashboard(
            self.organization, self.user.id, new_dashboard
        )

        assert DashboardFavoriteUser.objects.count() == 3
        assert new_favorite is not None
        assert new_favorite.position == 2

    def test_inserts_to_first_position_when_none_exist(self):
        new_dashboard = self.create_dashboard(title="New Dashboard", organization=self.organization)
        DashboardFavoriteUser.objects.insert_favorite_dashboard(
            self.organization, self.user.id, new_dashboard
        )

        new_favorite = DashboardFavoriteUser.objects.get_favorite_dashboard(
            self.organization, self.user.id, new_dashboard
        )

        assert DashboardFavoriteUser.objects.count() == 1
        assert new_favorite is not None
        assert new_favorite.position == 0

    def test_reorders_to_new_positions(self):
        should_be_second = self.create_dashboard(
            title="Should be second", organization=self.organization
        )
        should_be_first = self.create_dashboard(
            title="Should be first", organization=self.organization
        )

        second_favorite_dashboard = self.create_dashboard_favorite_user(
            should_be_second, self.user, self.organization, 0
        )
        first_favorite_dashboard = self.create_dashboard_favorite_user(
            should_be_first, self.user, self.organization, 1
        )

        assert second_favorite_dashboard.position == 0
        assert first_favorite_dashboard.position == 1

        DashboardFavoriteUser.objects.reorder_favorite_dashboards(
            self.organization, self.user.id, [should_be_first.id, should_be_second.id]
        )

        for favorite_dashboard in [second_favorite_dashboard, first_favorite_dashboard]:
            favorite_dashboard.refresh_from_db()

        assert second_favorite_dashboard.position == 1
        assert first_favorite_dashboard.position == 0

    def test_reorders_to_new_positions_with_missing_positions(self):
        should_be_second = self.create_dashboard(
            title="Should be second", organization=self.organization
        )
        should_be_first = self.create_dashboard(
            title="Should be first", organization=self.organization
        )

        second_favorite_dashboard = self.create_dashboard_favorite_user(
            should_be_second, self.user, self.organization, None
        )
        first_favorite_dashboard = self.create_dashboard_favorite_user(
            should_be_first, self.user, self.organization, 1
        )

        assert second_favorite_dashboard.position is None
        assert first_favorite_dashboard.position == 1

        DashboardFavoriteUser.objects.reorder_favorite_dashboards(
            self.organization, self.user.id, [should_be_first.id, should_be_second.id]
        )

        for favorite_dashboard in [second_favorite_dashboard, first_favorite_dashboard]:
            favorite_dashboard.refresh_from_db()

        assert second_favorite_dashboard.position == 1
        assert first_favorite_dashboard.position == 0

    def test_deletes_and_increments_existing_positions(self):
        first_dashboard = self.create_dashboard(
            title="First Dashboard", organization=self.organization
        )
        second_dashboard = self.create_dashboard(
            title="Second Dashboard", organization=self.organization
        )

        self.create_dashboard_favorite_user(first_dashboard, self.user, self.organization, 0)
        self.create_dashboard_favorite_user(second_dashboard, self.user, self.organization, 1)

        assert DashboardFavoriteUser.objects.count() == 2

        DashboardFavoriteUser.objects.delete_favorite_dashboard(
            self.organization, self.user.id, first_dashboard
        )

        dashboard = DashboardFavoriteUser.objects.get_favorite_dashboard(
            self.organization, self.user.id, second_dashboard
        )
        assert DashboardFavoriteUser.objects.count() == 1
        assert dashboard is not None
        assert dashboard.position == 0
