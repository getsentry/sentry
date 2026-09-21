import importlib
from unittest import mock

from sentry.testutils.cases import TestMigrations

# A leading digit is legal in a module name but not in the dotted path mock.patch parses,
# so the module has to be imported by hand to patch anything on it.
migration = importlib.import_module("sentry.migrations.1178_backfill_release_new_last_deploy_id")


class BackfillReleaseNewLastDeployIdTest(TestMigrations):
    app = "sentry"
    migrate_from = "1177_drop_dashboardhiddenuser"
    migrate_to = "1178_backfill_release_new_last_deploy_id"

    def setUp(self):
        # A handful of rows spans several batches at this size, so the migration's
        # chunking is actually exercised rather than served by a single batch.
        with mock.patch.object(migration, "BATCH_SIZE", 2):
            super().setUp()

    def setup_initial_state(self):
        self.organization = self.create_organization()

    def setup_before_migration(self, apps):
        Release = apps.get_model("sentry", "Release")

        def create_release(version, last_deploy_id, new_last_deploy_id):
            return Release.objects.create(
                organization_id=self.organization.id,
                version=version,
                last_deploy_id=last_deploy_id,
                new_last_deploy_id=new_last_deploy_id,
            )

        self.pending = [create_release(f"pending-{i}", 100 + i, None) for i in range(5)]

        # Two nulls are already in sync, which is what stops "new_last_deploy_id is null"
        # from being a usable test for unfilled.
        self.never_deployed = create_release("never-deployed", None, None)

        self.already_synced = create_release("already-synced", 200, 200)

        # A shadow value over a null deploy is the mismatch "is null" would miss.
        self.stale_shadow = create_release("stale-shadow", None, 999)

    def test_backfills_every_row_out_of_sync(self):
        for release in self.pending:
            release.refresh_from_db()
            assert release.new_last_deploy_id == release.last_deploy_id

        self.never_deployed.refresh_from_db()
        assert self.never_deployed.new_last_deploy_id is None

        self.already_synced.refresh_from_db()
        assert self.already_synced.new_last_deploy_id == 200

        self.stale_shadow.refresh_from_db()
        assert self.stale_shadow.new_last_deploy_id is None
