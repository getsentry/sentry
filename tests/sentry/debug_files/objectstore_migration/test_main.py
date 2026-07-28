from __future__ import annotations

from collections.abc import Generator
from unittest.mock import patch

import pytest
from django.db.models import Max

from sentry.debug_files.objectstore_migration import start_migration
from sentry.models.debugfile import ProjectDebugFile
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class DebugFileObjectstoreMigrationMainTest(TestCase):
    @pytest.fixture(autouse=True)
    def enable_migration(self) -> Generator[None]:
        with override_options({"debug-files.objectstore-migration.killswitch": False}):
            yield

    def test_start_migration_enqueues_all_shards_from_scratch(self) -> None:
        high_water_mark = ProjectDebugFile.objects.aggregate(max_id=Max("id"))["max_id"] or 0

        with patch(
            "sentry.debug_files.objectstore_migration.tasks.migrate_shard.apply_async"
        ) as enqueue:
            start_migration(num_shards=3)

        assert enqueue.call_count == 3
        kwargs_list = [call.kwargs["kwargs"] for call in enqueue.call_args_list]
        assert {k["shard_id"] for k in kwargs_list} == {0, 1, 2}
        for kwargs in kwargs_list:
            assert kwargs["num_shards"] == 3
            assert kwargs["high_water_mark"] == high_water_mark
            assert kwargs["cursor"] == 0

    def test_start_migration_resume_enqueues_only_mapped_shards(self) -> None:
        with patch(
            "sentry.debug_files.objectstore_migration.tasks.migrate_shard.apply_async"
        ) as enqueue:
            start_migration(
                num_shards=4,
                high_water_mark=99,
                cursors={1: 40, 3: 41},
            )

        kwargs_by_shard = {
            call.kwargs["kwargs"]["shard_id"]: call.kwargs["kwargs"]
            for call in enqueue.call_args_list
        }
        assert set(kwargs_by_shard) == {1, 3}
        assert kwargs_by_shard[1]["cursor"] == 40
        assert kwargs_by_shard[3]["cursor"] == 41
        assert kwargs_by_shard[1]["num_shards"] == 4
        assert kwargs_by_shard[1]["high_water_mark"] == 99
