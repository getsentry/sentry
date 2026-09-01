from __future__ import annotations

from unittest.mock import patch

from sentry.debug_files.objectstore_migration.tasks import migrate_shard
from sentry.testutils.cases import TestCase
from sentry.utils.locking import UnableToAcquireLock


class DebugFileObjectstoreMigrationTaskTest(TestCase):
    def test_page_self_chains_or_completes(self) -> None:
        debug_files = [self.create_dif_file(project=self.project) for _ in range(3)]
        ordered_ids = sorted(df.id for df in debug_files)
        start_cursor = ordered_ids[-1]

        with (
            patch(
                "sentry.debug_files.objectstore_migration.tasks._FILES_PER_ACTIVATION",
                2,
            ),
            patch(
                "sentry.debug_files.objectstore_migration.tasks.migrate_debug_file",
            ) as migrate_one,
            patch.object(migrate_shard, "apply_async_with_future") as enqueue_successor,
            patch("sentry.debug_files.objectstore_migration.tasks.locks.get"),
        ):
            # full page → self-chain with inclusive cursor below lowest processed
            migrate_shard(
                shard_id=0,
                num_shards=1,
                cursor=start_cursor,
            )
            assert migrate_one.call_count == 2
            assert [c.args[0].id for c in migrate_one.call_args_list] == [
                ordered_ids[2],
                ordered_ids[1],
            ]
            enqueue_successor.assert_called_once()
            assert enqueue_successor.call_args.kwargs["kwargs"] == {
                "shard_id": 0,
                "num_shards": 1,
                "cursor": ordered_ids[1] - 1,
            }

            migrate_one.reset_mock()
            enqueue_successor.reset_mock()

            # short page → done, no successor
            migrate_shard(
                shard_id=0,
                num_shards=1,
                cursor=ordered_ids[1] - 1,
            )
            assert migrate_one.call_count == 1
            assert migrate_one.call_args.args[0].id == ordered_ids[0]
            enqueue_successor.assert_not_called()

    def test_duplicate_shard_exits_when_lock_is_held(self) -> None:
        with (
            patch("sentry.debug_files.objectstore_migration.tasks.locks.get") as get_lock,
            patch(
                "sentry.debug_files.objectstore_migration.tasks.logger.exception"
            ) as logger_exception,
            patch(
                "sentry.debug_files.objectstore_migration.tasks.migrate_debug_file"
            ) as migrate_one,
        ):
            get_lock.return_value.acquire.side_effect = UnableToAcquireLock()

            migrate_shard(shard_id=2, num_shards=64, cursor=100)

        migrate_one.assert_not_called()
        logger_exception.assert_called_once_with(
            "debug_files.objectstore_migration.shard_already_running",
            extra={
                "shard_id": 2,
                "num_shards": 64,
                "cursor": 100,
                "activation_attempt": None,
            },
        )
