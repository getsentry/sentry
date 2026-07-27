from __future__ import annotations

from collections.abc import Generator
from unittest.mock import patch

import pytest

from sentry.debug_files.objectstore_migration_tasks import enqueue_shard_heads, migrate_shard
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class DebugFileObjectstoreMigrationTaskTest(TestCase):
    @pytest.fixture(autouse=True)
    def enable_migration(self) -> Generator[None]:
        with override_options({"debug-files.objectstore-migration.killswitch": False}):
            yield

    def test_enqueue_shard_heads_enqueues_all_shards(self) -> None:
        run = self.create_debug_file_objectstore_migration_run(shard_count=2)

        with patch(
            "sentry.debug_files.objectstore_migration_tasks.migrate_shard.apply_async"
        ) as enqueue_shard:
            asserted = enqueue_shard_heads(run)

        assert asserted == 2
        assert enqueue_shard.call_count == 2

    def test_empty_shard_completes_without_successor(self) -> None:
        run = self.create_debug_file_objectstore_migration_run()
        shard = run.shards.get()

        with patch.object(migrate_shard, "apply_async") as enqueue_successor:
            migrate_shard(run.id, shard.shard_id)

        enqueue_successor.assert_not_called()

    def test_activation_limit_self_chains_even_on_short_final_batch(self) -> None:
        debug_files = [self.create_dif_file(project=self.project) for _ in range(3)]
        run = self.create_debug_file_objectstore_migration_run(
            high_water_mark=max(df.id for df in debug_files),
        )
        shard = run.shards.get()

        with (
            patch(
                "sentry.debug_files.objectstore_migration_tasks._MAX_FILES_PER_ACTIVATION",
                2,
            ),
            patch(
                "sentry.debug_files.objectstore_migration_tasks._QUERY_BATCH_SIZE",
                3,
            ),
            patch(
                "sentry.debug_files.objectstore_migration_tasks.migrate_debug_file",
            ) as migrate_one,
            patch.object(migrate_shard, "apply_async") as enqueue_successor,
        ):
            migrate_shard(run.id, shard.shard_id)

        assert migrate_one.call_count == 2
        enqueue_successor.assert_called_once()

    def test_shard_failure_reraises_without_successor(self) -> None:
        debug_file = self.create_dif_file(project=self.project)
        run = self.create_debug_file_objectstore_migration_run(high_water_mark=debug_file.id)
        shard = run.shards.get()

        with (
            patch(
                "sentry.debug_files.objectstore_migration_tasks.migrate_debug_file",
                side_effect=ValueError("permanent failure"),
            ),
            patch.object(migrate_shard, "apply_async") as enqueue_successor,
            pytest.raises(ValueError, match="permanent failure"),
        ):
            migrate_shard(run.id, shard.shard_id)

        enqueue_successor.assert_not_called()

    @override_options({"debug-files.objectstore-migration.killswitch": True})
    def test_killswitch_fails_task_before_work(self) -> None:
        run = self.create_debug_file_objectstore_migration_run()
        shard = run.shards.get()

        with pytest.raises(RuntimeError, match="killswitched"):
            migrate_shard(run.id, shard.shard_id)
