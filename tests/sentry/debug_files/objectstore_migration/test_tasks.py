from __future__ import annotations

from unittest.mock import patch

from sentry.debug_files.objectstore_migration.tasks import migrate_shard
from sentry.testutils.cases import TestCase


class DebugFileObjectstoreMigrationTaskTest(TestCase):
    def test_page_self_chains_or_completes(self) -> None:
        debug_files = [self.create_dif_file(project=self.project) for _ in range(3)]
        high_water_mark = max(df.id for df in debug_files)
        ordered_ids = sorted(df.id for df in debug_files)

        with (
            patch(
                "sentry.debug_files.objectstore_migration.tasks._FILES_PER_ACTIVATION",
                2,
            ),
            patch(
                "sentry.debug_files.objectstore_migration.tasks.migrate_debug_file",
            ) as migrate_one,
            patch.object(migrate_shard, "apply_async") as enqueue_successor,
        ):
            # full page → self-chain with advanced cursor
            migrate_shard(
                shard_id=0,
                num_shards=1,
                high_water_mark=high_water_mark,
                cursor=0,
            )
            assert migrate_one.call_count == 2
            enqueue_successor.assert_called_once()
            assert enqueue_successor.call_args.kwargs["kwargs"] == {
                "shard_id": 0,
                "num_shards": 1,
                "cursor": ordered_ids[1],
                "high_water_mark": high_water_mark,
            }

            migrate_one.reset_mock()
            enqueue_successor.reset_mock()

            # short page → done, no successor
            migrate_shard(
                shard_id=0,
                num_shards=1,
                high_water_mark=high_water_mark,
                cursor=ordered_ids[1],
            )
            assert migrate_one.call_count == 1
            enqueue_successor.assert_not_called()
