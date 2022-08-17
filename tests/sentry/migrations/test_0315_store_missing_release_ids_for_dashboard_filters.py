from sentry.testutils.cases import TestMigrations


class TestStoreMissingReleaseIDsInDashboardFilters(TestMigrations):
    migrate_from = "0314_bit_int_for_org_and_project_id"
    migrate_to = "0315_store_missing_release_ids_for_dashboard_filters"

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
        self.dashboard_with_filters_but_not_release = Dashboard.objects.create(
            title="Dashboard with filters but not release",
            created_by_id=self.user.id,
            organization_id=self.organization.id,
            filters={"all_projects": True},
        )

    def test(self):
        self.dashboard_with_latest.refresh_from_db()
        self.dashboard_without_releases.refresh_from_db()
        self.dashboard_with_no_filters.refresh_from_db()
        self.dashboard_with_filters_but_not_release.refresh_from_db()

        assert self.dashboard_with_latest.filters["release_id"] == [self.test_release.id, "latest"]
        assert self.dashboard_without_releases.filters.get("release_id") is None
        assert self.dashboard_with_no_filters.filters is None
        assert self.dashboard_with_filters_but_not_release.filters == {"all_projects": True}
