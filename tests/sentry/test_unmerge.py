import time
import uuid
from dataclasses import replace
from unittest.mock import Mock, patch

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError

from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.issues.unmerge_recovery import (
    RETENTION_SECONDS,
    BatchCheckpoint,
    UnmergeBusy,
    UnmergeNeedsRecovery,
    client,
    owner_key,
    reserve_legacy_hashes,
)
from sentry.models.grouphash import GroupHash
from sentry.tasks.unmerge import lock_hashes, start_unmerge, unmerge
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.unmerge import (
    InitialUnmergeArgs,
    PrimaryHashUnmergeReplacement,
    SuccessiveUnmergeArgs,
    UnmergeArgsBase,
)


def test_argument_parsing_endpoint() -> None:
    """
    Tests task invocations done from group_hashes endpoint.
    """
    args = UnmergeArgsBase.parse_arguments(123, 345, None, ["a" * 32], None)
    assert args == InitialUnmergeArgs(
        project_id=123,
        source_id=345,
        destinations={},
        replacement=PrimaryHashUnmergeReplacement(
            fingerprints=["a" * 32],
        ),
        actor_id=None,
        batch_size=500,
    )

    dumped = args.dump_arguments()
    assert dumped == {
        "actor_id": None,
        "batch_size": 500,
        "destination_id": None,
        "destinations": {},
        "fingerprints": None,
        "project_id": 123,
        "replacement": {
            "fingerprints": [
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            ],
            "type": "primary_hash",
        },
        "source_id": 345,
    }

    assert UnmergeArgsBase.parse_arguments(**dumped) == args


def test_argument_parsing_page2() -> None:
    """
    Tests task invocations done from an older version of the unmerge task.
    This test only exists such that argument parsing is not broken across
    deploys, but in a few years it may be fine to break compat with old queue
    items and remove this test.
    """

    args = UnmergeArgsBase.parse_arguments(
        123,
        345,
        567,
        ["a" * 32],
        666,
        last_event={"hello": "world"},
        batch_size=500,
        source_fields_reset=True,
        eventstream_state={"state": True},
    )

    assert args == SuccessiveUnmergeArgs(
        project_id=123,
        source_id=345,
        destinations={"default": (567, {"state": True})},
        replacement=PrimaryHashUnmergeReplacement(fingerprints=["a" * 32]),
        actor_id=666,
        last_event={"hello": "world"},
        locked_primary_hashes=["a" * 32],
        batch_size=500,
        source_fields_reset=True,
    )

    assert UnmergeArgsBase.parse_arguments(**args.dump_arguments()) == args


class UnmergeRecoveryTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.source = self.create_group(project=self.project)
        self.fingerprint = "a" * 32
        self.group_hash = Factories.create_group_hash(group=self.source, hash=self.fingerprint)
        self.args = InitialUnmergeArgs(
            project_id=self.project.id,
            source_id=self.source.id,
            replacement=PrimaryHashUnmergeReplacement(fingerprints=[self.fingerprint]),
            actor_id=None,
            batch_size=500,
            destinations={},
            operation_id=uuid.uuid4().hex,
            operation_expires_at=int(time.time()) + RETENTION_SECONDS,
        )

    def test_recovery_arguments_round_trip(self) -> None:
        arguments = self.args.dump_arguments()
        assert UnmergeArgsBase.parse_arguments(**arguments) == self.args
        assert UnmergeArgsBase.parse_arguments(**arguments) == self.args

    def test_lock_intent_survives_transaction_rollback(self) -> None:
        queryset_type = type(GroupHash.objects.all())
        original_update = queryset_type.update

        def interrupted_update(
            queryset: BaseQuerySet[GroupHash, GroupHash], **kwargs: object
        ) -> int:
            original_update(queryset, **kwargs)
            raise KeyboardInterrupt()

        with BatchCheckpoint(self.args) as checkpoint:
            with (
                patch.object(queryset_type, "update", interrupted_update),
                pytest.raises(KeyboardInterrupt),
            ):
                checkpoint.lock_hashes()
            assert checkpoint.phase == "locking"

        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.UNLOCKED
        with BatchCheckpoint(self.args) as redelivery:
            assert redelivery.lock_hashes() == [self.fingerprint]
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.LOCKED_IN_MIGRATION

    def test_hard_death_after_sql_commit(self) -> None:
        # Deliberately do not call __exit__: a killed process cannot release its
        # lease. Simulate Redis lease expiry, then a different broker delivery.
        killed = BatchCheckpoint(self.args).__enter__()
        assert killed.lock_hashes() == [self.fingerprint]
        with pytest.raises(UnmergeBusy):
            BatchCheckpoint(self.args).__enter__()
        client().delete(killed.lease_key)
        with BatchCheckpoint(self.args) as redelivery:
            assert redelivery.lock_hashes() == [self.fingerprint]
            with pytest.raises(UnmergeBusy):
                killed.begin_mutations()
            killed.__exit__(None, None, None)
            assert client().get(redelivery.lease_key) == redelivery.token

    def test_sql_commit_before_reading_checkpoint(self) -> None:
        with BatchCheckpoint(self.args) as checkpoint:
            save = checkpoint.save

            def interrupted_save(phase: str, **updates: object) -> None:
                if phase == "reading":
                    raise KeyboardInterrupt()
                save(phase, **updates)

            with (
                patch.object(checkpoint, "save", interrupted_save),
                pytest.raises(KeyboardInterrupt),
            ):
                checkpoint.lock_hashes()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.LOCKED_IN_MIGRATION
        with BatchCheckpoint(self.args) as redelivery:
            assert redelivery.phase == "locking"
            assert redelivery.lock_hashes() == [self.fingerprint]

    def test_other_operations_and_legacy_tasks_cannot_claim_pending_locks(self) -> None:
        # Simulate interruption after Redis reservation, before the SQL flag.
        assert self.args.operation_id is not None
        client().set(owner_key(self.project.id, self.fingerprint), self.args.operation_id, ex=600)
        assert lock_hashes(self.project.id, self.source.id, [self.fingerprint]) == []
        with BatchCheckpoint(replace(self.args, operation_id=uuid.uuid4().hex)) as other:
            assert other.lock_hashes() == []
        with BatchCheckpoint(self.args) as owner:
            assert owner.lock_hashes() == [self.fingerprint]

    def test_legacy_reservation_prevents_tracked_acquisition(self) -> None:
        with reserve_legacy_hashes(self.project.id, [self.fingerprint]) as reserved:
            assert reserved == [self.fingerprint]
            with BatchCheckpoint(self.args) as checkpoint:
                assert checkpoint.lock_hashes() == []

    @patch("sentry.tasks.unmerge.task_run_batch_query", return_value=(None, []))
    def test_legacy_release_failure_does_not_strand_sql_locks(self, query: Mock) -> None:
        with (
            patch(
                "sentry.issues.unmerge_recovery.release_hashes",
                side_effect=RedisConnectionError("reservation cleanup interrupted"),
            ),
            patch("sentry.tasks.unmerge.truncate_denormalizations"),
        ):
            unmerge(self.project.id, self.source.id, None, [self.fingerprint], None)
        query.assert_called_once()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.UNLOCKED
        assert client().ttl(owner_key(self.project.id, self.fingerprint)) > 0

    def test_legacy_release_failure_preserves_original_error(self) -> None:
        with (
            patch(
                "sentry.issues.unmerge_recovery.release_hashes",
                side_effect=RedisConnectionError("reservation cleanup interrupted"),
            ),
            pytest.raises(ValueError, match="lock acquisition interrupted"),
            reserve_legacy_hashes(self.project.id, [self.fingerprint]),
        ):
            raise ValueError("lock acquisition interrupted")

    def test_missing_checkpoint_does_not_adopt_sql_lock(self) -> None:
        with BatchCheckpoint(self.args) as checkpoint:
            checkpoint.lock_hashes()
        client().delete(checkpoint.key)
        with BatchCheckpoint(self.args) as redelivery, pytest.raises(UnmergeNeedsRecovery):
            redelivery.lock_hashes()

    def test_recreated_or_moved_hash_is_not_adopted(self) -> None:
        with BatchCheckpoint(self.args) as checkpoint:
            checkpoint.lock_hashes()
        destination = self.create_group(project=self.project)
        self.group_hash.update(group_id=destination.id)
        with BatchCheckpoint(self.args) as redelivery, pytest.raises(UnmergeNeedsRecovery):
            redelivery.lock_hashes()

    def test_expired_operation_fails_closed(self) -> None:
        with pytest.raises(UnmergeNeedsRecovery):
            BatchCheckpoint(replace(self.args, operation_expires_at=int(time.time()) - 1))

    def test_manual_unlock_is_not_undone_by_redelivery(self) -> None:
        with BatchCheckpoint(self.args) as checkpoint:
            checkpoint.lock_hashes()
        self.group_hash.update(state=GroupHash.State.UNLOCKED)
        with BatchCheckpoint(self.args) as redelivery, pytest.raises(UnmergeNeedsRecovery):
            redelivery.lock_hashes()

    @patch("sentry.tasks.unmerge.task_run_batch_query")
    @patch("sentry.tasks.unmerge.truncate_denormalizations")
    def test_legacy_redelivery_with_no_owned_hashes_does_not_reset_source(
        self, truncate: Mock, query: Mock
    ) -> None:
        self.group_hash.update(state=GroupHash.State.LOCKED_IN_MIGRATION)
        unmerge(self.project.id, self.source.id, None, [self.fingerprint], None)
        truncate.assert_not_called()
        query.assert_not_called()

    @patch("sentry.tasks.unmerge.task_run_batch_query")
    def test_killswitch_releases_recovered_initial_locks(self, query: Mock) -> None:
        with BatchCheckpoint(self.args) as checkpoint:
            checkpoint.lock_hashes()
        with self.options({"unmerge.killswitch-projects": [{"project_id": self.project.id}]}):
            unmerge(**self.args.dump_arguments())
        query.assert_not_called()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.UNLOCKED
        assert client().get(owner_key(self.project.id, self.fingerprint)) is None

    @patch("sentry.tasks.unmerge.task_run_batch_query")
    def test_later_read_failure_does_not_reapply_previous_batch(self, query: Mock) -> None:
        arguments = {
            **self.args.dump_arguments(),
            "batch_number": 1,
            "last_event": {"timestamp": "old-cursor", "event_id": "b" * 32},
            "locked_primary_hashes": [self.fingerprint],
        }
        with BatchCheckpoint(self.args) as parent:
            parent.lock_hashes()
            parent.begin_mutations()
            parent.handoff(arguments)
        query.side_effect = MemoryError()
        with patch("sentry.tasks.unmerge.truncate_denormalizations") as truncate:
            with pytest.raises(UnmergeBusy):
                unmerge(**arguments)
            query.side_effect = None
            query.return_value = (None, [])
            unmerge(**arguments)
        truncate.assert_not_called()
        assert query.call_count == 2
        assert query.call_args.kwargs["state"] == arguments["last_event"]

    def test_missing_continuation_fails_closed(self) -> None:
        with pytest.raises(UnmergeNeedsRecovery):
            BatchCheckpoint(replace(self.args, batch_number=1)).__enter__()

    @patch("sentry.tasks.unmerge.truncate_denormalizations")
    @patch("sentry.tasks.unmerge.task_run_batch_query")
    def test_read_failure_retries_owned_hashes_before_truncating(
        self, query: Mock, truncate: Mock
    ) -> None:
        query.side_effect = MemoryError("event hydration interrupted")
        with pytest.raises(UnmergeBusy):
            unmerge(**self.args.dump_arguments())
        truncate.assert_not_called()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.LOCKED_IN_MIGRATION

        query.side_effect = None
        query.return_value = (None, [])
        with self.options({"unmerge.max-batch-size": 17}):
            unmerge(**self.args.dump_arguments())
        assert query.call_args.kwargs["batch_size"] == 17
        truncate.assert_called_once()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.UNLOCKED
        assert client().get(owner_key(self.project.id, self.fingerprint)) is None

        # A different activation of the same logical batch does no work.
        query.reset_mock()
        unmerge(**self.args.dump_arguments())
        query.assert_not_called()

    @patch("sentry.tasks.unmerge.truncate_denormalizations")
    @patch("sentry.tasks.unmerge.task_run_batch_query", return_value=(None, []))
    def test_mutation_failure_requires_recovery(self, query: Mock, truncate: Mock) -> None:
        truncate.side_effect = RuntimeError("partial aggregate changes")
        with pytest.raises(RuntimeError, match="partial aggregate"):
            unmerge(**self.args.dump_arguments())
        query.reset_mock()
        with pytest.raises(UnmergeNeedsRecovery, match="partially applied"):
            unmerge(**self.args.dump_arguments())
        query.assert_not_called()
        truncate.assert_called_once()

    @patch.object(unmerge, "apply_async_with_future")
    def test_handoff_retries_delivery_without_reapplying_batch(self, send: Mock) -> None:
        next_arguments = {**self.args.dump_arguments(), "batch_number": 1}

        def apply_batch(args: object, checkpoint: BatchCheckpoint) -> None:
            checkpoint.begin_mutations()
            checkpoint.handoff(next_arguments)
            # Simulate death after saving the continuation, before enqueue.
            raise KeyboardInterrupt()

        with patch("sentry.tasks.unmerge._unmerge", side_effect=apply_batch) as apply:
            with pytest.raises(KeyboardInterrupt):
                unmerge(**self.args.dump_arguments())
            send.assert_not_called()
            send.return_value.result.side_effect = TimeoutError("delivery unknown")
            with pytest.raises(UnmergeBusy):
                unmerge(**self.args.dump_arguments())
            send.return_value.result.side_effect = None
            unmerge(**self.args.dump_arguments())
            unmerge(**self.args.dump_arguments())
            apply.assert_called_once()
        assert send.call_count == 2
        send.return_value.result.assert_called_with(timeout=30)

        # A duplicated child delivery has its own stable checkpoint even when
        # the parent didn't receive a delivery confirmation.
        with BatchCheckpoint(replace(self.args, batch_number=1)) as child:
            child.complete()
        with patch("sentry.tasks.unmerge._unmerge") as apply:
            unmerge(**next_arguments)
        apply.assert_not_called()

    @patch.object(unmerge, "apply_async_with_future")
    def test_starter_resends_same_operation_when_delivery_is_unknown(self, send: Mock) -> None:
        send.return_value.result.side_effect = TimeoutError()
        with pytest.raises(UnmergeBusy):
            start_unmerge(
                self.project.id,
                self.source.id,
                None,
                [self.fingerprint],
                None,
                operation_id=self.args.operation_id,
                operation_expires_at=self.args.operation_expires_at,
            )
        assert send.call_args.kwargs["kwargs"]["operation_id"] == self.args.operation_id

    @patch.object(unmerge, "apply_async_with_future")
    def test_lost_checkpoint_write_response_can_resume_saved_handoff(self, send: Mock) -> None:
        arguments = {**self.args.dump_arguments(), "batch_number": 1}

        def apply_batch(args: object, checkpoint: BatchCheckpoint) -> None:
            checkpoint.begin_mutations()
            checkpoint.handoff(arguments)
            # Redis committed the handoff but the worker lost its response.
            raise RedisConnectionError()

        with patch("sentry.tasks.unmerge._unmerge", side_effect=apply_batch) as apply:
            with pytest.raises(UnmergeBusy):
                unmerge(**self.args.dump_arguments())
            unmerge(**self.args.dump_arguments())
            apply.assert_called_once()
        send.assert_called_once_with(kwargs=arguments)

    @patch("sentry.tasks.unmerge._send_unmerge")
    @patch("sentry.tasks.unmerge.repair_denormalizations")
    @patch("sentry.tasks.unmerge.truncate_denormalizations")
    @patch("sentry.tasks.unmerge.migrate_events", return_value=(123, None))
    @patch("sentry.tasks.unmerge.task_run_batch_query")
    def test_replacement_and_continuation_only_include_owned_hashes(
        self, query: Mock, migrate: Mock, truncate: Mock, repair: Mock, send: Mock
    ) -> None:
        other_hash = "b" * 32
        Factories.create_group_hash(group=self.source, hash=other_hash)
        client().set(owner_key(self.project.id, other_hash), "another-operation", ex=600)
        arguments = replace(
            self.args,
            replacement=PrimaryHashUnmergeReplacement(fingerprints=[self.fingerprint, other_hash]),
        ).dump_arguments()
        raw_event = Mock()
        raw_event.for_group.return_value.get_primary_hash.return_value = self.fingerprint
        query.return_value = ({"timestamp": "cursor", "event_id": "c" * 32}, [raw_event])
        unmerge(**arguments)

        replacement = migrate.call_args.args[3].replacement
        assert list(replacement.fingerprints) == [self.fingerprint]
        assert send.call_args.args[0]["replacement"]["fingerprints"] == [self.fingerprint]
