import importlib
from unittest import mock

from sentry.testutils.cases import TestMigrations

# A leading digit is legal in a module name but not in the dotted path mock.patch parses,
# so the module has to be imported by hand to patch anything on it.
migration = importlib.import_module("sentry.migrations.1185_backfill_release_new_id")


class BackfillReleaseNewIdTest(TestMigrations):
    app = "sentry"
    migrate_from = "1184_custominboundfilter_add_legacy_filter"
    migrate_to = "1185_backfill_release_new_id"

    def setUp(self):
        with mock.patch.object(migration, "BATCH_SIZE", 2):
            super().setUp()

    def setup_initial_state(self):
        self.organization = self.create_organization()

    def setup_before_migration(self, apps):
        Release = apps.get_model("sentry", "Release")

        def create_release(version):
            return Release.objects.create(organization_id=self.organization.id, version=version)

        self.pending = [create_release(f"pending-{i}") for i in range(5)]

        self.already_synced = create_release("already-synced")
        Release.objects.filter(id=self.already_synced.id).update(new_id=self.already_synced.id)

        self.stale_shadow = create_release("stale-shadow")
        Release.objects.filter(id=self.stale_shadow.id).update(new_id=self.stale_shadow.id + 1000)

    def test_backfills_every_row_out_of_sync(self):
        releases = [*self.pending, self.already_synced, self.stale_shadow]
        for release in releases:
            release.refresh_from_db()
            assert release.new_id == release.id
