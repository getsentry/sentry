from __future__ import annotations

from collections.abc import Generator
from unittest.mock import patch

import pytest
from django.db import IntegrityError

from sentry.debug_files.objectstore_migration import (
    create_migration_run,
    resume_failed_shards,
    supersede_migration_run,
)
from sentry.models.debugfile_migration import (
    DebugFileObjectstoreMigrationRun,
    DebugFileObjectstoreMigrationRunStatus,
    DebugFileObjectstoreMigrationShardStatus,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class DebugFileObjectstoreMigrationModelTest(TestCase):
    @pytest.fixture(autouse=True)
    def enable_migration(self) -> Generator[None]:
        with override_options({"debug-files.objectstore-migration.killswitch": False}):
            yield

    def test_create_run_captures_high_water_mark_and_shards(self) -> None:
        debug_file = self.create_dif_file(project=self.project)

        run = create_migration_run(shard_count=3)

        assert run.high_water_mark == debug_file.id
        assert run.shard_count == 3
        assert run.generation == 1
        assert list(run.shards.order_by("shard_id").values_list("shard_id", flat=True)) == [
            0,
            1,
            2,
        ]

    def test_only_one_run_can_be_active(self) -> None:
        self.create_debug_file_objectstore_migration_run()

        with pytest.raises(ValueError, match="already active"):
            create_migration_run(shard_count=1)

        with pytest.raises(IntegrityError):
            DebugFileObjectstoreMigrationRun.objects.create(high_water_mark=0, shard_count=1)

    def test_resume_preserves_cursor_and_generation(self) -> None:
        run = self.create_debug_file_objectstore_migration_run(
            status=DebugFileObjectstoreMigrationRunStatus.FAILED
        )
        shard = run.shards.get()
        shard.status = DebugFileObjectstoreMigrationShardStatus.FAILED
        shard.cursor_id = 42
        shard.failing_debug_file_id = 43
        shard.last_error = "failed"
        shard.save()

        with patch(
            "sentry.debug_files.objectstore_migration_tasks.migrate_shard.apply_async"
        ) as enqueue_shard:
            updated = resume_failed_shards(run.id)

        assert updated == 1
        enqueue_shard.assert_called_once()
        run.refresh_from_db()
        shard.refresh_from_db()
        assert run.status == DebugFileObjectstoreMigrationRunStatus.RUNNING
        assert run.generation == 1
        assert shard.status == DebugFileObjectstoreMigrationShardStatus.PENDING
        assert shard.cursor_id == 42
        assert shard.failing_debug_file_id is None
        assert shard.last_error is None

    def test_supersede_increments_generation(self) -> None:
        run = self.create_debug_file_objectstore_migration_run()

        supersede_migration_run(run.id)

        run.refresh_from_db()
        assert run.status == DebugFileObjectstoreMigrationRunStatus.SUPERSEDED
        assert run.generation == 2
        assert run.finished_at is not None
