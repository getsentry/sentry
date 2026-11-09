import uuid
from dataclasses import replace
from unittest.mock import Mock, patch

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError

from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.issues.unmerge_recovery import (
    UnmergeBusy,
    UnmergeCheckpoint,
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
        batch_size=250,
    )

    dumped = args.dump_arguments()
    assert dumped == {
        "actor_id": None,
        "batch_size": 250,
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

        with UnmergeCheckpoint(self.args) as checkpoint:
            with (
                patch.object(queryset_type, "update", interrupted_update),
                pytest.raises(KeyboardInterrupt),
            ):
                checkpoint.lock_hashes()
            assert checkpoint.phase == "reading"

        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.UNLOCKED
        with UnmergeCheckpoint(self.args) as redelivery:
            assert redelivery.lock_hashes() == [self.fingerprint]
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.LOCKED_IN_MIGRATION

    def test_hard_death_after_sql_commit(self) -> None:
        # A killed worker cannot release its lease. Simulate its expiry.
        killed = UnmergeCheckpoint(self.args).__enter__()
        assert killed.lock_hashes() == [self.fingerprint]
        with pytest.raises(UnmergeBusy):
            UnmergeCheckpoint(self.args).__enter__()
        client().delete(killed.lease_key)
        with UnmergeCheckpoint(self.args) as redelivery:
            assert redelivery.lock_hashes() == [self.fingerprint]
            with pytest.raises(UnmergeBusy):
                killed.begin_mutations()
            killed.__exit__(None, None, None)
            assert client().get(redelivery.lease_key) == redelivery.token

    @patch("sentry.tasks.unmerge.task_run_batch_query")
    def test_ownership_conflict_rejects_the_whole_request(self, query: Mock) -> None:
        other_hash = "b" * 32
        Factories.create_group_hash(group=self.source, hash=other_hash)
        client().set(owner_key(self.project.id, other_hash), "another-operation", ex=600)
        arguments = replace(
            self.args,
            replacement=PrimaryHashUnmergeReplacement(fingerprints=[self.fingerprint, other_hash]),
        ).dump_arguments()

        with pytest.raises(UnmergeNeedsRecovery, match="another unmerge"):
            unmerge(**arguments)
        query.assert_not_called()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.UNLOCKED
        assert client().get(owner_key(self.project.id, self.fingerprint)) is None
        assert client().get(owner_key(self.project.id, other_hash)) == "another-operation"

    def test_legacy_and_recoverable_tasks_respect_ownership(self) -> None:
        with reserve_legacy_hashes(self.project.id, [self.fingerprint]):
            with UnmergeCheckpoint(self.args) as checkpoint:
                with pytest.raises(UnmergeNeedsRecovery):
                    checkpoint.lock_hashes()
        with UnmergeCheckpoint(self.args) as checkpoint:
            assert checkpoint.lock_hashes() == [self.fingerprint]
        with pytest.raises(UnmergeNeedsRecovery):
            lock_hashes(self.project.id, self.source.id, [self.fingerprint])

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

    def test_locked_hash_without_checkpoint_is_not_adopted(self) -> None:
        self.group_hash.update(state=GroupHash.State.LOCKED_IN_MIGRATION)
        with UnmergeCheckpoint(self.args) as redelivery, pytest.raises(UnmergeNeedsRecovery):
            redelivery.lock_hashes()
        assert client().get(owner_key(self.project.id, self.fingerprint)) is None

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
        with UnmergeCheckpoint(self.args) as checkpoint:
            checkpoint.lock_hashes()
        with self.options({"unmerge.killswitch-projects": [{"project_id": self.project.id}]}):
            unmerge(**self.args.dump_arguments())
        query.assert_not_called()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.UNLOCKED
        assert client().get(owner_key(self.project.id, self.fingerprint)) is None

    @patch("sentry.tasks.unmerge.truncate_denormalizations")
    @patch("sentry.tasks.unmerge.task_run_batch_query")
    def test_read_failure_resumes_owned_hashes_before_truncating(
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
        unmerge(**self.args.dump_arguments())
        assert query.call_args.kwargs["batch_size"] == 500
        truncate.assert_called_once()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.UNLOCKED
        assert client().get(owner_key(self.project.id, self.fingerprint)) is None

        query.reset_mock()
        unmerge(**self.args.dump_arguments())
        query.assert_not_called()

    @patch("sentry.tasks.unmerge.task_run_batch_query")
    def test_later_read_failure_resumes_its_cursor(self, query: Mock) -> None:
        arguments = {
            **self.args.dump_arguments(),
            "batch_number": 1,
            "last_event": {"timestamp": "old-cursor", "event_id": "b" * 32},
            "locked_primary_hashes": [self.fingerprint],
        }
        with UnmergeCheckpoint(self.args) as parent:
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

    @patch("sentry.tasks.unmerge.truncate_denormalizations")
    @patch("sentry.tasks.unmerge.task_run_batch_query", return_value=(None, []))
    def test_interrupted_mutations_are_not_replayed(self, query: Mock, truncate: Mock) -> None:
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

        def apply_batch(args: object, checkpoint: UnmergeCheckpoint) -> None:
            checkpoint.begin_mutations()
            checkpoint.handoff(next_arguments)
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

            with UnmergeCheckpoint(replace(self.args, batch_number=1)) as child:
                child.complete()
            unmerge(**self.args.dump_arguments())
            unmerge(**next_arguments)
            apply.assert_called_once()
        assert send.call_count == 2
        send.return_value.result.assert_called_with(timeout=30)

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
            )
        assert send.call_args.kwargs["kwargs"]["operation_id"] == self.args.operation_id

    def test_missing_checkpoint_cannot_resume_a_later_batch(self) -> None:
        with pytest.raises(UnmergeNeedsRecovery):
            UnmergeCheckpoint(replace(self.args, batch_number=1)).__enter__()
