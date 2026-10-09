from types import SimpleNamespace
from unittest.mock import patch

import pytest
from redis.exceptions import RedisError

from sentry.issues.unmerge_initial import (
    InitialUnmergeBusy,
    InitialUnmergeCheckpoint,
    InitialUnmergeNeedsRecovery,
    InitialUnmergeOwnershipLost,
    claim_first_continuation,
    get_client,
    hash_owner_key,
)
from sentry.models.grouphash import GroupHash, GroupHashQuerySet
from sentry.tasks.unmerge import lock_hashes, unmerge
from sentry.testutils.cases import TestCase
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
        batch_size=500,
        locked_primary_hashes=["a" * 32],
        source_fields_reset=True,
    )

    assert UnmergeArgsBase.parse_arguments(**args.dump_arguments()) == args


class InitialUnmergeCheckpointTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.source = self.create_n_groups_with_hashes(1, self.project)[0]
        self.group_hash = GroupHash.objects.get(group=self.source)

    def acquire(self, activation_id="initial"):
        return InitialUnmergeCheckpoint.acquire(
            self.project.id, self.source.id, activation_id, [self.group_hash.hash]
        )

    def invoke_initial(self) -> None:
        unmerge(self.project.id, self.source.id, None, [self.group_hash.hash], self.user.id)

    def assert_redelivery(self, rollout_enabled: bool) -> None:
        task = SimpleNamespace(id="initial")
        with (
            self.feature("organizations:unmerge-recovery"),
            patch("sentry.tasks.unmerge.current_task", return_value=task),
            patch("sentry.tasks.unmerge.truncate_denormalizations"),
            patch("sentry.tasks.unmerge.task_run_batch_query", side_effect=KeyboardInterrupt),
            pytest.raises(KeyboardInterrupt),
        ):
            self.invoke_initial()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.LOCKED_IN_MIGRATION

        with (
            self.feature({"organizations:unmerge-recovery": rollout_enabled}),
            patch("sentry.tasks.unmerge.current_task", return_value=task),
            patch("sentry.tasks.unmerge.truncate_denormalizations"),
            patch("sentry.tasks.unmerge.task_run_batch_query", return_value=(None, [])),
        ):
            self.invoke_initial()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state is None
        assert get_client().get(hash_owner_key(self.project.id, self.group_hash.hash)) is None

    def test_redelivery_recovers_initial_owned_hashes(self) -> None:
        self.assert_redelivery(rollout_enabled=True)

    def test_redelivery_remains_tracked_after_rollout_disabled(self) -> None:
        self.assert_redelivery(rollout_enabled=False)

    def test_sql_failure_keeps_write_ahead_ownership(self) -> None:
        with self.acquire() as checkpoint:
            with (
                patch.object(GroupHashQuerySet, "update", side_effect=RuntimeError),
                pytest.raises(RuntimeError),
            ):
                checkpoint.lock_hashes()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state is None
        with self.acquire("competitor") as competitor:
            assert competitor.lock_hashes() == []
            competitor.complete()
        assert lock_hashes(self.project.id, self.source.id, [self.group_hash.hash]) == []
        with self.acquire() as retry:
            assert retry.state.phase == "locked"
            assert retry.lock_hashes() == [self.group_hash.hash]
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.LOCKED_IN_MIGRATION

    def test_redis_failure_before_checkpoint_does_not_lock_sql_rows(self) -> None:
        with self.acquire() as checkpoint:
            with (
                patch.object(checkpoint, "save", side_effect=RedisError),
                pytest.raises(RedisError),
            ):
                checkpoint.lock_hashes()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state is None
        with self.acquire() as retry:
            assert retry.state.phase == "preparing"
            assert retry.lock_hashes() == [self.group_hash.hash]

    def test_initial_redis_failure_requests_retry_before_locking(self) -> None:
        with (
            self.feature("organizations:unmerge-recovery"),
            patch("sentry.tasks.unmerge.current_task", return_value=SimpleNamespace(id="initial")),
            patch("sentry.issues.unmerge_initial.get_client", side_effect=RedisError),
            pytest.raises(InitialUnmergeBusy),
        ):
            self.invoke_initial()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state is None

    def test_competing_activation_cannot_claim_existing_locks(self) -> None:
        with self.acquire() as checkpoint:
            checkpoint.lock_hashes()
        with self.acquire("competitor") as competitor:
            assert competitor.lock_hashes() == []
            competitor.complete()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.LOCKED_IN_MIGRATION
        assert get_client().get(hash_owner_key(self.project.id, self.group_hash.hash)) == "initial"

    def test_legacy_lock_without_owner_is_not_claimed(self) -> None:
        self.group_hash.update(state=GroupHash.State.LOCKED_IN_MIGRATION)
        with self.acquire() as checkpoint:
            assert checkpoint.lock_hashes() == []
            checkpoint.complete()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.LOCKED_IN_MIGRATION

    def test_missing_owner_is_not_interpreted_as_permission_to_resume(self) -> None:
        with self.acquire() as checkpoint:
            checkpoint.lock_hashes()
            checkpoint.client.delete(hash_owner_key(self.project.id, self.group_hash.hash))
        with self.acquire() as retry, pytest.raises(InitialUnmergeOwnershipLost):
            retry.lock_hashes()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.LOCKED_IN_MIGRATION

    def test_expired_lease_cannot_begin_mutations(self) -> None:
        with self.acquire() as checkpoint:
            checkpoint.lock_hashes()
            checkpoint.client.set(checkpoint.lease, "replacement", ex=600)
            with pytest.raises(InitialUnmergeOwnershipLost):
                checkpoint.begin_processing()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.LOCKED_IN_MIGRATION

    def test_expired_lease_cannot_relock_hashes(self) -> None:
        with self.acquire() as checkpoint:
            checkpoint.lock_hashes()
            self.group_hash.update(state=None)
            checkpoint.client.set(checkpoint.lease, "replacement", ex=600)
            with pytest.raises(InitialUnmergeOwnershipLost):
                checkpoint.lock_hashes()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state is None

    def test_mutation_phase_is_not_blindly_replayed(self) -> None:
        with self.acquire() as checkpoint:
            checkpoint.lock_hashes()
            checkpoint.begin_processing()
        with (
            self.feature("organizations:unmerge-recovery"),
            patch("sentry.tasks.unmerge.current_task", return_value=SimpleNamespace(id="initial")),
            patch("sentry.tasks.unmerge.task_run_batch_query") as query,
            pytest.raises(InitialUnmergeNeedsRecovery),
        ):
            self.invoke_initial()
        query.assert_not_called()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state == GroupHash.State.LOCKED_IN_MIGRATION

    def continuation(self):
        args = SuccessiveUnmergeArgs(
            project_id=self.project.id,
            source_id=self.source.id,
            replacement=PrimaryHashUnmergeReplacement(fingerprints=[self.group_hash.hash]),
            actor_id=self.user.id,
            batch_size=500,
            last_event={"timestamp": self.source.first_seen.isoformat(), "event_id": "a" * 32},
            destinations={},
            locked_primary_hashes=[self.group_hash.hash],
            source_fields_reset=True,
        )
        return {**args.dump_arguments(), "initial_checkpoint_id": "initial"}

    def test_failed_enqueue_retries_saved_continuation_without_reprocessing(self) -> None:
        continuation = self.continuation()
        with self.acquire() as checkpoint:
            checkpoint.lock_hashes()
            checkpoint.begin_processing()
            checkpoint.continue_with(continuation)
        with (
            self.feature("organizations:unmerge-recovery"),
            patch("sentry.tasks.unmerge.current_task", return_value=SimpleNamespace(id="initial")),
            patch("sentry.tasks.unmerge.task_run_batch_query") as query,
            patch.object(unmerge, "delay") as delay,
        ):
            self.invoke_initial()
        query.assert_not_called()
        delay.assert_called_once_with(**continuation)
        with self.acquire() as checkpoint:
            assert checkpoint.state.phase == "complete"

    def test_duplicate_first_continuation_is_not_processed(self) -> None:
        assert claim_first_continuation(self.project.id, "initial", "first-child") is True
        assert claim_first_continuation(self.project.id, "initial", "first-child") is True
        with (
            patch(
                "sentry.tasks.unmerge.current_task",
                return_value=SimpleNamespace(id="duplicate-child"),
            ),
            patch("sentry.tasks.unmerge.task_run_batch_query") as query,
        ):
            unmerge(**self.continuation())
        query.assert_not_called()

    def test_finishing_redelivery_only_unlocks_and_cleans_up(self) -> None:
        with self.acquire() as checkpoint:
            checkpoint.lock_hashes()
            checkpoint.begin_finishing()
        with (
            self.feature("organizations:unmerge-recovery"),
            patch("sentry.tasks.unmerge.current_task", return_value=SimpleNamespace(id="initial")),
            patch("sentry.tasks.unmerge.task_run_batch_query") as query,
        ):
            self.invoke_initial()
        query.assert_not_called()
        self.group_hash.refresh_from_db()
        assert self.group_hash.state is None

    def test_checkpoint_and_reservations_have_bounded_ttls(self) -> None:
        with self.acquire() as checkpoint:
            checkpoint.lock_hashes()
            assert 0 < checkpoint.client.ttl(checkpoint.key) <= 604800
            assert 0 < checkpoint.client.ttl(checkpoint.lease) <= 600
            assert (
                0
                < checkpoint.client.ttl(hash_owner_key(self.project.id, self.group_hash.hash))
                <= 604800
            )
