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
        with patch(
            "sentry.debug_files.objectstore_migration_tasks.migrate_shard.apply_async"
        ) as enqueue_shard:
            asserted = enqueue_shard_heads(shard_count=2, high_water_mark=10)

        assert asserted == 2
        assert enqueue_shard.call_count == 2
        kwargs_list = [call.kwargs["kwargs"] for call in enqueue_shard.call_args_list]
        assert {k["shard_id"] for k in kwargs_list} == {0, 1}
        for kwargs in kwargs_list:
            assert kwargs["shard_count"] == 2
            assert kwargs["high_water_mark"] == 10
            assert kwargs["cursor_id"] == 0

    def test_empty_shard_completes_without_successor(self) -> None:
        with patch.object(migrate_shard, "apply_async") as enqueue_successor:
            migrate_shard(shard_id=0, shard_count=1, high_water_mark=0, cursor_id=0)

        enqueue_successor.assert_not_called()

    def test_activation_limit_self_chains_with_advanced_cursor(self) -> None:
        debug_files = [self.create_dif_file(project=self.project) for _ in range(3)]
        high_water_mark = max(df.id for df in debug_files)

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
            migrate_shard(
                shard_id=0,
                shard_count=1,
                high_water_mark=high_water_mark,
                cursor_id=0,
            )

        assert migrate_one.call_count == 2
        enqueue_successor.assert_called_once()
        successor_kwargs = enqueue_successor.call_args.kwargs["kwargs"]
        assert successor_kwargs["cursor_id"] == sorted(df.id for df in debug_files)[1]
        assert successor_kwargs["high_water_mark"] == high_water_mark
        assert successor_kwargs["shard_id"] == 0
        assert successor_kwargs["shard_count"] == 1

    def test_shard_processes_until_exhausted_without_successor(self) -> None:
        debug_file = self.create_dif_file(project=self.project)

        with (
            patch(
                "sentry.debug_files.objectstore_migration_tasks.migrate_debug_file",
            ) as migrate_one,
            patch.object(migrate_shard, "apply_async") as enqueue_successor,
        ):
            migrate_shard(
                shard_id=0,
                shard_count=1,
                high_water_mark=debug_file.id,
                cursor_id=0,
            )

        assert migrate_one.call_count == 1
        enqueue_successor.assert_not_called()

    def test_shard_failure_reraises_without_successor(self) -> None:
        debug_file = self.create_dif_file(project=self.project)

        with (
            patch(
                "sentry.debug_files.objectstore_migration_tasks.migrate_debug_file",
                side_effect=ValueError("permanent failure"),
            ),
            patch.object(migrate_shard, "apply_async") as enqueue_successor,
            pytest.raises(ValueError, match="permanent failure"),
        ):
            migrate_shard(
                shard_id=0,
                shard_count=1,
                high_water_mark=debug_file.id,
                cursor_id=0,
            )

        enqueue_successor.assert_not_called()

    @override_options({"debug-files.objectstore-migration.killswitch": True})
    def test_killswitch_soft_stops_without_successor(self) -> None:
        debug_file = self.create_dif_file(project=self.project)

        with (
            patch(
                "sentry.debug_files.objectstore_migration_tasks.migrate_debug_file",
            ) as migrate_one,
            patch.object(migrate_shard, "apply_async") as enqueue_successor,
        ):
            # Must not raise — completes cleanly so taskworker will not retry.
            migrate_shard(
                shard_id=0,
                shard_count=1,
                high_water_mark=debug_file.id,
                cursor_id=0,
            )

        migrate_one.assert_not_called()
        enqueue_successor.assert_not_called()

    def test_killswitch_mid_activation_stops_without_successor(self) -> None:
        debug_files = [self.create_dif_file(project=self.project) for _ in range(3)]
        high_water_mark = max(df.id for df in debug_files)

        with (
            patch(
                "sentry.debug_files.objectstore_migration_tasks.migrate_debug_file",
            ) as migrate_one,
            # enter task, enter loop, before 1st file, after 1st file (before 2nd) → stop
            patch(
                "sentry.debug_files.objectstore_migration_tasks.is_migration_killswitched",
                side_effect=[False, False, False, True],
            ),
            patch.object(migrate_shard, "apply_async") as enqueue_successor,
        ):
            migrate_shard(
                shard_id=0,
                shard_count=1,
                high_water_mark=high_water_mark,
                cursor_id=0,
            )

        assert migrate_one.call_count == 1
        enqueue_successor.assert_not_called()
