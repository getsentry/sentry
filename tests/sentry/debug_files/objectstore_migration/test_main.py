from __future__ import annotations

from unittest.mock import patch

from django.db.models import Max

from sentry.debug_files.objectstore_migration import start_migration
from sentry.models.debugfile import ProjectDebugFile
from sentry.testutils.cases import TestCase


class DebugFileObjectstoreMigrationMainTest(TestCase):
    def test_start_migration_enqueues_shards(self) -> None:
        start_cursor = ProjectDebugFile.objects.aggregate(max_id=Max("id"))["max_id"] or 0

        with patch(
            "sentry.debug_files.objectstore_migration.tasks.migrate_shard.apply_async_with_future"
        ) as enqueue:
            start_migration(num_shards=3)
            start_migration(
                num_shards=4,
                cursors={1: 40, 3: 41},
            )

        # fresh run: every shard starts at the inclusive max id
        fresh = [c.kwargs["kwargs"] for c in enqueue.call_args_list[:3]]
        assert {k["shard_id"] for k in fresh} == {0, 1, 2}
        for kwargs in fresh:
            assert kwargs == {
                "shard_id": kwargs["shard_id"],
                "num_shards": 3,
                "cursor": start_cursor,
            }

        # resume: only the listed shards, with the given cursors
        resume = {
            c.kwargs["kwargs"]["shard_id"]: c.kwargs["kwargs"] for c in enqueue.call_args_list[3:]
        }
        assert resume == {
            1: {
                "shard_id": 1,
                "num_shards": 4,
                "cursor": 40,
            },
            3: {
                "shard_id": 3,
                "num_shards": 4,
                "cursor": 41,
            },
        }
