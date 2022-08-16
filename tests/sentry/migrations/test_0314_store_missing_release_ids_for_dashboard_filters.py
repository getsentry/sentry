from sentry.testutils.cases import TestMigrations


class TestStoreMissingReleaseIDsInDashboardFilters(TestMigrations):
    migrate_from = "0313_sentry_functions_env_variables"
    migrate_to = "0314_store_missing_release_ids_for_dashboard_filters"

    def setup_before_migration(self, apps):
        Release = apps.get_model("sentry", "Release")
        Dashboard = apps.get_model("sentry", "Dashboard")

        self.test_release = Release.objects.create(
            organization_id=self.organization.id, version="test@1.2.3"
        )
        self.dashboard_with_latest = Dashboard.objects.create(
            title="Dashboard with latest",
            created_by_id=self.user.id,
            organization_id=self.organization.id,
            filters={"release": [self.test_release.version, "latest"]},
        )
        self.dashboard_without_releases = Dashboard.objects.create(
            title="Dashboard with no release filters",
            created_by_id=self.user.id,
            organization_id=self.organization.id,
            filters={"release": []},
        )
        self.dashboard_with_no_filters = Dashboard.objects.create(
            title="Dashboard with no filters",
            created_by_id=self.user.id,
            organization_id=self.organization.id,
        )

    def test(self):
        assert self.dashboard_with_latest.filters["release_id"] == [self.test_release.id, "latest"]
        assert self.dashboard_without_releases.get("release_id", None) is None
        assert self.dashboard_with_no_filters.filters is None
