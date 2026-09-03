from __future__ import annotations

from unittest.mock import patch

import pytest
from django.db.models import Max

from sentry.debug_files.objectstore_migration import start_migration
from sentry.debug_files.objectstore_migration.durable import (
    IDS_PER_QUERY,
    ShardRunResult,
    _process_next_batch,
    initialize_migration,
    run_migration_shard,
)
from sentry.models.debugfile import DebugFileObjectstoreMigrationState, ProjectDebugFile
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


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

    def test_initialize_migration_creates_one_cursor_per_shard(self) -> None:
        debug_files = [self.create_dif_file(project=self.project) for _ in range(4)]
        max_id = max(debug_file.id for debug_file in debug_files)

        initialize_migration(shard_count=3)
        initialize_migration(shard_count=3)

        states = list(DebugFileObjectstoreMigrationState.objects.order_by("shard_id"))
        assert len(states) == 3
        assert [state.shard_id for state in states] == [0, 1, 2]
        assert {state.cursor for state in states} == {max_id}

        with pytest.raises(RuntimeError, match="different shard count"):
            initialize_migration(shard_count=2)

    def test_initialize_migration_is_a_noop_when_killswitched(self) -> None:
        with override_options({"debug-files.objectstore-migration.enabled": False}):
            initialize_migration(shard_count=3)

        assert not DebugFileObjectstoreMigrationState.objects.exists()

    def test_process_next_batch_checkpoints_cursor(self) -> None:
        debug_files = [self.create_dif_file(project=self.project) for _ in range(3)]
        max_id = max(debug_file.id for debug_file in debug_files)
        state = DebugFileObjectstoreMigrationState.objects.create(
            shard_id=0,
            cursor=max_id,
        )

        with patch(
            "sentry.debug_files.objectstore_migration.durable.migrate_debug_file"
        ) as migrate_one:
            has_more = _process_next_batch(state, shard_count=1)

        assert not has_more
        assert [call.args[0].id for call in migrate_one.call_args_list] == sorted(
            (debug_file.id for debug_file in debug_files), reverse=True
        )
        state.refresh_from_db()
        assert state.cursor == 0

    def test_modulo_shards_process_disjoint_debug_files(self) -> None:
        debug_files = [self.create_dif_file(project=self.project) for _ in range(6)]
        max_id = max(debug_file.id for debug_file in debug_files)
        states = [
            DebugFileObjectstoreMigrationState.objects.create(shard_id=shard_id, cursor=max_id)
            for shard_id in range(2)
        ]

        migrated_ids: dict[int, set[int]] = {}
        for state in states:
            with patch(
                "sentry.debug_files.objectstore_migration.durable.migrate_debug_file"
            ) as migrate_one:
                _process_next_batch(state, shard_count=2)
            migrated_ids[state.shard_id] = {call.args[0].id for call in migrate_one.call_args_list}

        assert migrated_ids[0].isdisjoint(migrated_ids[1])
        assert migrated_ids[0] | migrated_ids[1] == {debug_file.id for debug_file in debug_files}

    def test_empty_query_advances_by_bounded_id_window(self) -> None:
        state = DebugFileObjectstoreMigrationState.objects.create(
            shard_id=0,
            cursor=IDS_PER_QUERY * 2,
        )

        assert _process_next_batch(state, shard_count=1)

        state.refresh_from_db()
        assert state.cursor == IDS_PER_QUERY

    def test_killswitch_does_not_checkpoint_partial_batch(self) -> None:
        debug_file = self.create_dif_file(project=self.project)
        state = DebugFileObjectstoreMigrationState.objects.create(
            shard_id=0,
            cursor=debug_file.id,
        )

        with (
            patch(
                "sentry.debug_files.objectstore_migration.durable.options.get",
                return_value=False,
            ),
            patch(
                "sentry.debug_files.objectstore_migration.durable.migrate_debug_file"
            ) as migrate_one,
        ):
            assert _process_next_batch(state, shard_count=1)

        migrate_one.assert_not_called()
        state.refresh_from_db()
        assert state.cursor == debug_file.id

    def test_run_shard_exits_when_not_initialized_or_killswitched(self) -> None:
        assert (
            run_migration_shard(shard_id=0, shard_count=3, max_runtime_seconds=1)
            == ShardRunResult.NOT_INITIALIZED
        )

        with override_options({"debug-files.objectstore-migration.enabled": False}):
            assert (
                run_migration_shard(shard_id=0, shard_count=3, max_runtime_seconds=1)
                == ShardRunResult.KILLSWITCHED
            )

    def test_run_shard_leaves_cursor_unchanged_when_migration_fails(self) -> None:
        debug_file = self.create_dif_file(project=self.project)
        initialize_migration(shard_count=1)
        state = DebugFileObjectstoreMigrationState.objects.get(shard_id=0)

        with patch(
            "sentry.debug_files.objectstore_migration.durable.migrate_debug_file",
            side_effect=RuntimeError("migration failed"),
        ):
            with pytest.raises(RuntimeError, match="migration failed"):
                run_migration_shard(shard_id=0, shard_count=1, max_runtime_seconds=1)

        state.refresh_from_db()
        assert state.cursor == debug_file.id
