import importlib
from unittest import mock

import pytest

from sentry.testutils.cases import TestMigrations
from sentry.utils.redis import redis_clusters

# A leading digit is legal in a module name but not in the dotted path mock.patch parses,
# so the module has to be imported by hand to patch anything on it.
migration = importlib.import_module("sentry.migrations.1233_backfill_grouprelease_new_release_id")


@pytest.mark.skip(reason="Migration already applied; test is slow and only useful before merge")
class BackfillGroupReleaseNewReleaseIdTest(TestMigrations):
    app = "sentry"
    migrate_from = "1232_backfill_commit_new_repository_id"
    migrate_to = "1233_backfill_grouprelease_new_release_id"

    def setUp(self):
        self.redis_client = redis_clusters.get("default")
        self.redis_client.delete(migration.RESUME_ID_KEY)
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

        assert self.redis_client.get(migration.RESUME_ID_KEY) is None


@pytest.mark.skip(reason="Migration already applied; test is slow and only useful before merge")
class BackfillGroupReleaseNewReleaseIdResumeTest(TestMigrations):
    app = "sentry"
    migrate_from = "1232_backfill_commit_new_repository_id"
    migrate_to = "1233_backfill_grouprelease_new_release_id"

    def setUp(self):
        self.redis_client = redis_clusters.get("default")
        with mock.patch.object(migration, "BATCH_SIZE", 2):
            super().setUp()

    def setup_initial_state(self):
        self.project = self.create_project()
        self.group = self.create_group(project=self.project)

    def setup_before_migration(self, apps):
        GroupRelease = apps.get_model("sentry", "GroupRelease")
        self.rows = [
            GroupRelease.objects.create(
                project_id=self.project.id, group_id=self.group.id, release_id=release_id
            )
            for release_id in range(1, 6)
        ]
        GroupRelease.objects.filter(id=self.rows[0].id).update(new_release_id=101)
        GroupRelease.objects.filter(id=self.rows[1].id).update(new_release_id=102)
        self.redis_client.set(migration.RESUME_ID_KEY, self.rows[2].id, ex=60)

    def test_resumes_from_the_stored_id_and_clears_it(self):
        for row in self.rows:
            row.refresh_from_db()

        assert [row.new_release_id for row in self.rows] == [101, 102, 3, 4, 5]
        assert self.redis_client.get(migration.RESUME_ID_KEY) is None
