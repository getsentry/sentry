from __future__ import annotations

from collections.abc import Generator
from unittest.mock import patch

import pytest

from sentry.debug_files.objectstore_migration import freeze_high_water_mark, start_migration
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class DebugFileObjectstoreMigrationMainTest(TestCase):
    @pytest.fixture(autouse=True)
    def enable_migration(self) -> Generator[None]:
        with override_options({"debug-files.objectstore-migration.killswitch": False}):
            yield

    def test_start_migration_enqueues_shards_with_hwm(self) -> None:
        high_water_mark = freeze_high_water_mark()

        with patch(
            "sentry.debug_files.objectstore_migration.tasks.migrate_shard.apply_async"
        ) as enqueue:
            asserted = start_migration(shard_count=3)

        assert asserted == 3
        assert enqueue.call_count == 3
        kwargs_list = [call.kwargs["kwargs"] for call in enqueue.call_args_list]
        assert {k["shard_id"] for k in kwargs_list} == {0, 1, 2}
        for kwargs in kwargs_list:
            assert kwargs["shard_count"] == 3
            assert kwargs["high_water_mark"] == high_water_mark
            assert kwargs["cursor_id"] == 0

    def test_start_migration_resume_preserves_cursors(self) -> None:
        with patch(
            "sentry.debug_files.objectstore_migration.tasks.migrate_shard.apply_async"
        ) as enqueue:
            asserted = start_migration(
                shard_count=2,
                high_water_mark=99,
                cursors={0: 40, 1: 41},
                shard_ids=[0, 1],
            )

        assert asserted == 2
        kwargs_by_shard = {
            call.kwargs["kwargs"]["shard_id"]: call.kwargs["kwargs"]
            for call in enqueue.call_args_list
        }
        assert kwargs_by_shard[0]["cursor_id"] == 40
        assert kwargs_by_shard[1]["cursor_id"] == 41
        assert kwargs_by_shard[0]["high_water_mark"] == 99
