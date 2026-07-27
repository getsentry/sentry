from __future__ import annotations

from collections.abc import Generator
from unittest.mock import patch

import pytest

from sentry.debug_files.objectstore_migration import resume_migration, start_migration
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class DebugFileObjectstoreMigrationModelTest(TestCase):
    @pytest.fixture(autouse=True)
    def enable_migration(self) -> Generator[None]:
        with override_options({"debug-files.objectstore-migration.killswitch": False}):
            yield

    def test_start_migration_captures_high_water_mark_and_enqueues(self) -> None:
        debug_file = self.create_dif_file(project=self.project)

        with patch(
            "sentry.debug_files.objectstore_migration_tasks.migrate_shard.apply_async"
        ) as enqueue_shard:
            run = start_migration(shard_count=3)

        assert run.high_water_mark == debug_file.id
        assert run.shard_count == 3
        assert list(run.shards.order_by("shard_id").values_list("shard_id", flat=True)) == [
            0,
            1,
            2,
        ]
        assert enqueue_shard.call_count == 3

    def test_resume_preserves_cursor_and_reenqueues(self) -> None:
        run = self.create_debug_file_objectstore_migration_run(shard_count=1)
        shard = run.shards.get()
        shard.cursor_id = 42
        shard.save(update_fields=["cursor_id"])

        with patch(
            "sentry.debug_files.objectstore_migration_tasks.migrate_shard.apply_async"
        ) as enqueue_shard:
            updated = resume_migration(run.id)

        assert updated == 1
        enqueue_shard.assert_called_once()
        shard.refresh_from_db()
        assert shard.cursor_id == 42
