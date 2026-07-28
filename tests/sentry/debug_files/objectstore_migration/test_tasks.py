from __future__ import annotations

from collections.abc import Generator
from unittest.mock import patch

import pytest

from sentry.debug_files.objectstore_migration.tasks import migrate_shard
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class DebugFileObjectstoreMigrationTaskTest(TestCase):
    @pytest.fixture(autouse=True)
    def enable_migration(self) -> Generator[None]:
        with override_options({"debug-files.objectstore-migration.killswitch": False}):
            yield

    def test_activation_limit_self_chains_with_advanced_cursor(self) -> None:
        debug_files = [self.create_dif_file(project=self.project) for _ in range(3)]
        high_water_mark = max(df.id for df in debug_files)

        with (
            patch(
                "sentry.debug_files.objectstore_migration.tasks._MAX_FILES_PER_ACTIVATION",
                2,
            ),
            patch(
                "sentry.debug_files.objectstore_migration.tasks._QUERY_BATCH_SIZE",
                3,
            ),
            patch(
                "sentry.debug_files.objectstore_migration.tasks.migrate_debug_file",
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
                "sentry.debug_files.objectstore_migration.tasks.migrate_debug_file",
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
