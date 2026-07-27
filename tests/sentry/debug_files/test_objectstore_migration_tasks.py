from __future__ import annotations

from unittest.mock import patch

import pytest

from sentry.debug_files.objectstore_migration_tasks import enqueue_shard_heads, migrate_shard
from sentry.models.debugfile_migration import (
    DebugFileObjectstoreMigrationRunStatus,
    DebugFileObjectstoreMigrationShardStatus,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class DebugFileObjectstoreMigrationTaskTest(TestCase):
    @pytest.fixture(autouse=True)
    def enable_migration(self):
        with override_options({"debug-files.objectstore-migration.killswitch": False}):
            yield

    def test_enqueue_shard_heads_enqueues_incomplete_shards(self) -> None:
        run = self.create_debug_file_objectstore_migration_run(
            shard_count=2,
            status=DebugFileObjectstoreMigrationRunStatus.RUNNING,
        )
        completed = run.shards.get(shard_id=0)
        completed.status = DebugFileObjectstoreMigrationShardStatus.COMPLETED
        completed.save(update_fields=["status"])

        with patch(
            "sentry.debug_files.objectstore_migration_tasks.migrate_shard.apply_async"
        ) as enqueue_shard:
            asserted = enqueue_shard_heads(run)

        assert asserted == 1
        assert enqueue_shard.call_count == 1
        kwargs = enqueue_shard.call_args.kwargs["kwargs"]
        assert kwargs["shard_id"] == 1

    def test_empty_shard_completes_without_successor(self) -> None:
        run = self.create_debug_file_objectstore_migration_run(
            status=DebugFileObjectstoreMigrationRunStatus.RUNNING,
        )
        shard = run.shards.get()

        with patch.object(migrate_shard, "apply_async") as enqueue_successor:
            migrate_shard(run.id, shard.shard_id, run.generation, shard.task_generation)

        shard.refresh_from_db()
        assert shard.status == DebugFileObjectstoreMigrationShardStatus.COMPLETED
        enqueue_successor.assert_not_called()

    def test_shard_failure_is_fail_fast(self) -> None:
        debug_file = self.create_dif_file(project=self.project)
        run = self.create_debug_file_objectstore_migration_run(
            high_water_mark=debug_file.id,
            status=DebugFileObjectstoreMigrationRunStatus.RUNNING,
        )
        shard = run.shards.get()

        with (
            patch(
                "sentry.debug_files.objectstore_migration_tasks.migrate_debug_file",
                side_effect=ValueError("permanent failure"),
            ),
            patch.object(migrate_shard, "apply_async") as enqueue_successor,
        ):
            migrate_shard(run.id, shard.shard_id, run.generation, shard.task_generation)

        shard.refresh_from_db()
        assert shard.status == DebugFileObjectstoreMigrationShardStatus.FAILED
        assert shard.cursor_id == 0
        assert shard.failing_debug_file_id == debug_file.id
        enqueue_successor.assert_not_called()

    @override_options({"debug-files.objectstore-migration.killswitch": True})
    def test_killswitch_fails_task_before_claiming_shard(self) -> None:
        run = self.create_debug_file_objectstore_migration_run(
            status=DebugFileObjectstoreMigrationRunStatus.RUNNING,
        )
        shard = run.shards.get()

        with pytest.raises(RuntimeError, match="killswitched"):
            migrate_shard(run.id, shard.shard_id, run.generation, shard.task_generation)

        shard.refresh_from_db()
        assert shard.status == DebugFileObjectstoreMigrationShardStatus.PENDING
        assert shard.task_generation == 0
