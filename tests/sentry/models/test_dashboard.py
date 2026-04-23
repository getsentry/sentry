from sentry.models.dashboard import Dashboard, DashboardFavoriteUser, DashboardRevision
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase
from sentry.users.models.user import User


class IncrementalNameTest(TestCase):
    def test_no_conflict(self) -> None:
        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats"

    def test_one_preexisting(self) -> None:
        self.create_dashboard(title="Stats", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy"

    def test_two_consecutive_preexisting(self) -> None:
        self.create_dashboard(title="Stats", organization=self.organization)
        self.create_dashboard(title="Stats copy", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy 1"

    def test_two_preexisting_non_starting(self) -> None:
        self.create_dashboard(title="Stats copy 4", organization=self.organization)
        self.create_dashboard(title="Stats copy 5", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy 6"

    def test_two_preexisting_non_starting_non_consecutive(self) -> None:
        self.create_dashboard(title="Stats copy 4", organization=self.organization)
        self.create_dashboard(title="Stats copy 17", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy 18"

    def test_copy_of_copy(self) -> None:
        self.create_dashboard(title="Stats copy 4", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats copy 4") == "Stats copy 5"

    def test_name_with_copy_in_it(self) -> None:
        assert Dashboard.incremental_title(self.organization, "Stats copy 4") == "Stats copy 4"

    def test_similar_names(self) -> None:
        self.create_dashboard(title="Stats", organization=self.organization)
        self.create_dashboard(title="Statstististicks", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats copy"

    def test_similar_name_substring(self) -> None:
        self.create_dashboard(title="Statstististicks", organization=self.organization)

        assert Dashboard.incremental_title(self.organization, "Stats") == "Stats"

    def test_across_organizations(self) -> None:
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
    ) -> DashboardFavoriteUser:
        return DashboardFavoriteUser.objects.create(
            dashboard=dashboard, user_id=user.id, organization=organization, position=position
        )

    def test_inserts_to_last_position(self) -> None:
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

    def test_inserts_to_first_position_when_none_exist(self) -> None:
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

    def test_reorders_to_new_positions(self) -> None:
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

    def test_reorders_to_new_positions_with_missing_positions(self) -> None:
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

    def test_deletes_and_increments_existing_positions(self) -> None:
        first_dashboard = self.create_dashboard(
            title="First Dashboard", organization=self.organization
        )
        second_dashboard = self.create_dashboard(
            title="Second Dashboard", organization=self.organization
        )

        self.create_dashboard_favorite_user(first_dashboard, self.user, self.organization, 0)
        self.create_dashboard_favorite_user(second_dashboard, self.user, self.organization, 1)

        assert DashboardFavoriteUser.objects.count() == 2

        DashboardFavoriteUser.objects.unfavorite_dashboard(
            self.organization, self.user.id, first_dashboard
        )

        dashboard = DashboardFavoriteUser.objects.get_favorite_dashboard(
            self.organization, self.user.id, second_dashboard
        )
        # Row still exists but with favorited=False
        assert DashboardFavoriteUser.objects.count() == 2
        assert DashboardFavoriteUser.objects.filter(favorited=True).count() == 1
        unfavorited = DashboardFavoriteUser.objects.get(dashboard=first_dashboard)
        assert unfavorited.favorited is False
        assert unfavorited.position is None
        assert dashboard is not None
        assert dashboard.position == 0


class DashboardRevisionTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.dashboard = self.create_dashboard(title="My Dashboard", organization=self.organization)

    def test_create_for_dashboard_stores_correct_fields(self) -> None:
        snapshot = {"title": "My Dashboard", "widgets": []}
        revision = DashboardRevision.create_for_dashboard(self.dashboard, self.user, snapshot)

        assert revision.dashboard == self.dashboard
        assert revision.title == self.dashboard.title
        assert revision.snapshot == snapshot
        assert revision.snapshot_schema_version == DashboardRevision.SNAPSHOT_SCHEMA_VERSION
        assert revision.created_by_id == self.user.id
        assert revision.source == "edit"

    def test_create_for_dashboard_stores_custom_source(self) -> None:
        revision = DashboardRevision.create_for_dashboard(
            self.dashboard, self.user, {}, source="edit-with-agent"
        )
        assert revision.source == "edit-with-agent"

    def test_create_for_dashboard_prunes_beyond_retention_limit(self) -> None:
        for i in range(DashboardRevision.RETENTION_LIMIT):
            DashboardRevision.objects.create(
                dashboard=self.dashboard,
                created_by_id=self.user.id,
                title=f"Revision {i}",
                snapshot={},
                snapshot_schema_version=DashboardRevision.SNAPSHOT_SCHEMA_VERSION,
            )

        DashboardRevision.create_for_dashboard(self.dashboard, self.user, {})

        assert (
            DashboardRevision.objects.filter(dashboard=self.dashboard).count()
            == DashboardRevision.RETENTION_LIMIT
        )

    def test_create_for_dashboard_retains_newest_revisions(self) -> None:
        titles = [f"Revision {i}" for i in range(DashboardRevision.RETENTION_LIMIT)]
        for title in titles:
            DashboardRevision.objects.create(
                dashboard=self.dashboard,
                created_by_id=self.user.id,
                title=title,
                snapshot={},
                snapshot_schema_version=DashboardRevision.SNAPSHOT_SCHEMA_VERSION,
            )

        new_revision = DashboardRevision.create_for_dashboard(self.dashboard, self.user, {})

        surviving_ids = set(
            DashboardRevision.objects.filter(dashboard=self.dashboard).values_list("id", flat=True)
        )
        # The oldest revision was pruned; the new one and the 9 most recent survive
        oldest = DashboardRevision.objects.filter(title="Revision 0").first()
        assert oldest is None
        assert new_revision.id in surviving_ids
