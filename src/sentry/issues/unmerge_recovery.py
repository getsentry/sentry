"""Fail-closed checkpoints for unmerge's read and enqueue boundaries.

These are not a transaction log for the mutations in an unmerge batch. A batch
interrupted after ``begin_mutations`` requires inspection, not automatic replay.
Missing/expired state must never be used to adopt an existing SQL lock.
"""

from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Generator, Mapping, Sequence
from contextlib import contextmanager
from typing import Any

from django.conf import settings
from django.db import router, transaction
from redis.client import StrictRedis
from redis.exceptions import RedisError
from sentry_redis_tools.clients import RedisCluster
from taskbroker_client.retry import RetryTaskError

from sentry.models.grouphash import GroupHash
from sentry.unmerge import UnmergeArgs
from sentry.utils import json, redis

# Longer than the task's 300s processing deadline. A hard-killed worker cannot
# release its lease; redelivery waits for expiry. Checkpoints have an absolute,
# bounded lifetime, independent of the number of redeliveries.
LEASE_SECONDS = 600
RETENTION_SECONDS = 7 * 24 * 60 * 60

logger = logging.getLogger(__name__)


class UnmergeBusy(RetryTaskError):
    pass


class UnmergeNeedsRecovery(Exception):
    pass


def client() -> RedisCluster[str] | StrictRedis[str]:
    return redis.redis_clusters.get(settings.SENTRY_UNMERGE_REDIS_CLUSTER)


def prefix(project_id: int) -> str:
    # Co-locate keys for the fenced state/continuation write on Redis Cluster.
    return f"unmerge:{{{project_id}}}:"


def owner_key(project_id: int, fingerprint: str) -> str:
    return f"{prefix(project_id)}owner:{fingerprint}"


def release_hashes(project_id: int, fingerprints: Sequence[str], owner: str) -> None:
    for fingerprint in fingerprints:
        client().eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then "
            "return redis.call('del', KEYS[1]) end return 0",
            1,
            owner_key(project_id, fingerprint),
            owner,
        )


@contextmanager
def reserve_legacy_hashes(project_id: int, fingerprints: Sequence[str]) -> Generator[list[str]]:
    """Keep untracked tasks from claiming a tracked task's pending SQL locks.

    All Redis calls are outside the SQL transaction. The SQL state still owns
    exclusion after the short-lived reservation is released.
    """
    token = uuid.uuid4().hex
    reserved: list[str] = []
    try:
        for fingerprint in sorted(set(fingerprints)):
            if client().set(owner_key(project_id, fingerprint), token, nx=True, ex=LEASE_SECONDS):
                reserved.append(fingerprint)
        yield reserved
    finally:
        try:
            release_hashes(project_id, reserved, token)
        except RedisError:
            # SQL locks already preserve exclusion after acquisition. The
            # reservations expire, so failed cleanup must not strand SQL locks
            # by aborting a legacy task before it can process any events.
            logger.exception(
                "unmerge.legacy_reservation.release_failed", extra={"project_id": project_id}
            )


class BatchCheckpoint:
    def __init__(self, args: UnmergeArgs) -> None:
        assert args.operation_id is not None
        if args.operation_expires_at is None or args.operation_expires_at <= time.time():
            raise UnmergeNeedsRecovery("Unmerge recovery window has expired")
        self.args = args
        self.owner = args.operation_id
        self.expires_at = args.operation_expires_at
        self.key = f"{prefix(args.project_id)}batch:{self.owner}:{args.batch_number}"
        self.lease_key = f"{self.key}:lease"
        self.token = uuid.uuid4().hex
        self.state: dict[str, Any] = {}

    @property
    def ttl(self) -> int:
        remaining = int(self.expires_at - time.time())
        if remaining <= 0:
            raise UnmergeNeedsRecovery("Unmerge recovery window has expired")
        return remaining

    @property
    def phase(self) -> str:
        return str(self.state["phase"])

    def __enter__(self) -> BatchCheckpoint:
        if not client().set(self.lease_key, self.token, nx=True, ex=min(LEASE_SECONDS, self.ttl)):
            raise UnmergeBusy("Another delivery owns this unmerge batch")
        try:
            raw = client().get(self.key)
            if raw is None:
                if self.args.batch_number != 0:
                    raise UnmergeNeedsRecovery("Missing continuation checkpoint")
                self.save("preparing")
            else:
                self.state = json.loads(raw)
            if self.phase == "applying":
                raise UnmergeNeedsRecovery("Unmerge batch may have partially applied mutations")
            return self
        except BaseException:
            self.__exit__(None, None, None)
            raise

    def __exit__(self, *exc: Any) -> None:
        client().eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then "
            "return redis.call('del', KEYS[1]) end return 0",
            1,
            self.lease_key,
            self.token,
        )

    def save(self, phase: str, **updates: Any) -> None:
        state = {**self.state, **updates, "phase": phase}
        if not client().eval(
            "if redis.call('get', KEYS[1]) ~= ARGV[1] then return 0 end "
            "redis.call('set', KEYS[2], ARGV[2], 'EX', ARGV[3]) return 1",
            2,
            self.lease_key,
            self.key,
            self.token,
            json.dumps(state),
            self.ttl,
        ):
            raise UnmergeBusy("Unmerge batch lease has expired")
        self.state = state

    def lock_hashes(self) -> list[str]:
        if self.phase == "preparing":
            reserved = []
            for fingerprint in sorted(set(self.args.replacement.primary_hashes_to_lock)):
                key = owner_key(self.args.project_id, fingerprint)
                if (
                    client().set(key, self.owner, nx=True, ex=self.ttl)
                    or client().get(key) == self.owner
                ):
                    reserved.append(fingerprint)
            # Reserve BEFORE reading SQL eligibility. Otherwise a legacy task
            # could lock a row and release its reservation between our read and
            # reservation, and we'd mistake its SQL lock for our own on retry.
            candidates = GroupHash.objects.filter(
                project_id=self.args.project_id,
                group_id=self.args.source_id,
                hash__in=reserved,
            ).exclude(state=GroupHash.State.LOCKED_IN_MIGRATION)
            owned = {
                fingerprint: row_id for row_id, fingerprint in candidates.values_list("id", "hash")
            }
            if GroupHash.objects.filter(
                project_id=self.args.project_id,
                hash__in=reserved,
                state=GroupHash.State.LOCKED_IN_MIGRATION,
            ).exists():
                raise UnmergeNeedsRecovery("Cannot adopt SQL locks without a checkpoint")
            # Persist intent BEFORE SQL. If the transaction rolls back, retry can
            # acquire these same rows. If it commits, retry can recognize its locks.
            self.save("locking", hashes=owned)

        owned = self.state["hashes"]
        release_hashes(
            self.args.project_id,
            list(set(self.args.replacement.primary_hashes_to_lock) - owned.keys()),
            self.owner,
        )
        self.check_ownership(list(owned))
        with transaction.atomic(router.db_for_write(GroupHash)):
            rows = list(
                GroupHash.objects.filter(project_id=self.args.project_id, id__in=owned.values())
                .order_by("id")
                .select_for_update()
            )
            if len(rows) != len(owned) or any(
                row.group_id != self.args.source_id or owned.get(row.hash) != row.id for row in rows
            ):
                raise UnmergeNeedsRecovery("Owned group hashes changed before processing")
            if self.phase == "reading" and any(
                row.state != GroupHash.State.LOCKED_IN_MIGRATION for row in rows
            ):
                raise UnmergeNeedsRecovery("Owned SQL locks were changed before processing")
            if self.phase == "locking":
                GroupHash.objects.filter(
                    project_id=self.args.project_id, id__in=owned.values()
                ).update(state=GroupHash.State.LOCKED_IN_MIGRATION)
        if self.phase == "locking":
            self.save("reading")
        return list(owned)

    def check_ownership(self, fingerprints: Sequence[str]) -> None:
        for fingerprint in fingerprints:
            if client().get(owner_key(self.args.project_id, fingerprint)) != self.owner:
                raise UnmergeNeedsRecovery("Unmerge hash ownership is missing or has changed")

    def begin_mutations(self) -> None:
        self.save("applying")

    def handoff(self, arguments: Mapping[str, Any]) -> None:
        child_key = f"{prefix(self.args.project_id)}batch:{self.owner}:{self.args.batch_number + 1}"
        state = {"phase": "handoff", "continuation": arguments}
        # The child's logical identity and checkpoint exist before any delivery.
        # A retry can send it twice; the child's lease/phase prevents replay.
        if not client().eval(
            "if redis.call('get', KEYS[1]) ~= ARGV[1] then return 0 end "
            "redis.call('set', KEYS[3], ARGV[4], 'EX', ARGV[3], 'NX') "
            "redis.call('set', KEYS[2], ARGV[2], 'EX', ARGV[3]) return 1",
            3,
            self.lease_key,
            self.key,
            child_key,
            self.token,
            json.dumps(state),
            self.ttl,
            json.dumps({"phase": "reading"}),
        ):
            raise UnmergeBusy("Unmerge batch lease has expired")
        self.state = state

    def complete(self) -> None:
        self.save("complete", continuation=None)
