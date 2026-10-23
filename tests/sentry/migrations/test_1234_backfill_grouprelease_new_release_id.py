import importlib
from unittest import mock

from sentry.testutils.cases import TestMigrations

# A leading digit is legal in a module name but not in the dotted path mock.patch parses,
# so the module has to be imported by hand to patch anything on it.
migration = importlib.import_module("sentry.migrations.1233_backfill_grouprelease_new_release_id")


class BackfillGroupReleaseNewReleaseIdTest(TestMigrations):
    app = "sentry"
    migrate_from = "1232_backfill_commit_new_repository_id"
    migrate_to = "1233_backfill_grouprelease_new_release_id"

    def setUp(self):
        with mock.patch.object(migration, "BATCH_SIZE", 2):
            super().setUp()

    def setup_initial_state(self):
        self.project = self.create_project()
        self.group = self.create_group(project=self.project)

    def setup_before_migration(self, apps):
        GroupRelease = apps.get_model("sentry", "GroupRelease")

        def create(release_id):
            return GroupRelease.objects.create(
                project_id=self.project.id, group_id=self.group.id, release_id=release_id
            )

        self.pending = [create(release_id) for release_id in range(1, 6)]

        self.already_synced = create(10)
        GroupRelease.objects.filter(id=self.already_synced.id).update(new_release_id=10)

        self.stale_shadow = create(20)
        GroupRelease.objects.filter(id=self.stale_shadow.id).update(new_release_id=1020)

        # Historical models skip GroupRelease.save(), so these start out null.
        assert all(row.new_release_id is None for row in self.pending)

    def test_backfills_every_row_out_of_sync(self):
        rows = [*self.pending, self.already_synced, self.stale_shadow]
        for row in rows:
            row.refresh_from_db()
            assert row.new_release_id == row.release_id
