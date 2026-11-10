"""Redis ownership and the current batch/stage of a recoverable unmerge."""

from __future__ import annotations

import logging
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

# A worker attempt has a 300s deadline. Recovery records outlive its lease.
LEASE_SECONDS = 600
RETENTION_SECONDS = 7 * 24 * 60 * 60
logger = logging.getLogger(__name__)
release_owned_key = redis.load_redis_script("utils/compare_and_delete.lua")
save_checkpoint_script = redis.load_redis_script("issues/unmerge/save_checkpoint.lua")


class UnmergeBusy(RetryTaskError):
    pass


class UnmergeNeedsRecovery(Exception):
    pass


def client() -> RedisCluster[str] | StrictRedis[str]:
    return redis.redis_clusters.get(settings.SENTRY_UNMERGE_REDIS_CLUSTER)


def owner_key(project_id: int, fingerprint: str) -> str:
    return f"unmerge:{{{project_id}}}:owner:{fingerprint}"


def claim_hashes(
    project_id: int, fingerprints: Sequence[str], owner: str, duration: int = RETENTION_SECONDS
) -> None:
    claimed: list[str] = []
    for fingerprint in sorted(set(fingerprints)):
        key = owner_key(project_id, fingerprint)
        if not (client().set(key, owner, nx=True, ex=duration) or client().get(key) == owner):
            release_hashes(project_id, claimed, owner)
            raise UnmergeNeedsRecovery("A fingerprint belongs to another unmerge")
        claimed.append(fingerprint)


def release_hashes(project_id: int, fingerprints: Sequence[str], owner: str) -> None:
    for fingerprint in fingerprints:
        release_owned_key(keys=[owner_key(project_id, fingerprint)], args=[owner], client=client())


@contextmanager
def reserve_legacy_hashes(project_id: int, fingerprints: Sequence[str]) -> Generator[None]:
    owner = uuid.uuid4().hex
    claim_hashes(project_id, fingerprints, owner, LEASE_SECONDS)
    try:
        yield
    finally:
        try:
            release_hashes(project_id, fingerprints, owner)
        except RedisError:
            # SQL already protects the acquired hashes; reservations expire.
            logger.exception(
                "unmerge.legacy_reservation.release_failed", extra={"project_id": project_id}
            )


class UnmergeCheckpoint:
    def __init__(self, args: UnmergeArgs) -> None:
        assert args.operation_id is not None
        self.args = args
        self.owner = args.operation_id
        self.key = f"unmerge:{{{args.project_id}}}:operation:{self.owner}"
        self.lease_key = f"{self.key}:lease"
        self.token = uuid.uuid4().hex
        self.state: dict[str, Any] = {}

    @property
    def phase(self) -> str:
        return str(self.state["phase"])

    @property
    def finished(self) -> bool:
        return self.phase == "complete" or self.args.batch_number < self.state["batch_number"]

    def __enter__(self) -> UnmergeCheckpoint:
        if not client().set(self.lease_key, self.token, nx=True, ex=LEASE_SECONDS):
            raise UnmergeBusy("Another worker is running this unmerge")
        try:
            raw = client().get(self.key)
            if raw is None:
                if self.args.batch_number:
                    raise UnmergeNeedsRecovery("Missing unmerge checkpoint")
                self.state = {"phase": "new", "batch_number": 0}
            else:
                self.state = json.loads(raw)
            if self.args.batch_number > self.state["batch_number"]:
                if (
                    self.phase != "handoff"
                    or self.args.batch_number != self.state["batch_number"] + 1
                ):
                    raise UnmergeNeedsRecovery("Unexpected unmerge batch")
                self.save("reading", batch_number=self.args.batch_number, continuation=None)
            return self
        except BaseException:
            self.__exit__(None, None, None)
            raise

    def __exit__(self, *exc: Any) -> None:
        release_owned_key(keys=[self.lease_key], args=[self.token], client=client())

    def save(self, phase: str, **updates: Any) -> None:
        state = {**self.state, **updates, "phase": phase}
        if not save_checkpoint_script(
            keys=[self.lease_key, self.key],
            args=[self.token, json.dumps(state), RETENTION_SECONDS],
            client=client(),
        ):
            raise UnmergeBusy("Unmerge worker lease has expired")
        self.state = state

    def lock_hashes(self) -> list[str]:
        fingerprints = sorted(set(self.args.replacement.primary_hashes_to_lock))
        hashes = GroupHash.objects.filter(
            project_id=self.args.project_id,
            group_id=self.args.source_id,
            hash__in=fingerprints,
        )
        if self.phase == "new":
            claim_hashes(self.args.project_id, fingerprints, self.owner)
            if hashes.filter(state=GroupHash.State.LOCKED_IN_MIGRATION).exists():
                release_hashes(self.args.project_id, fingerprints, self.owner)
                raise UnmergeNeedsRecovery("Fingerprints are locked without an owned checkpoint")
            # Remember ownership before SQL changes, so a retry can resume
            # whether the transaction committed or rolled back.
            self.save("reading")
        else:
            self.check_ownership(fingerprints)
        with transaction.atomic(router.db_for_write(GroupHash)):
            rows = list(hashes.order_by("id").select_for_update())
            if len(rows) == len(fingerprints):
                hashes.update(state=GroupHash.State.LOCKED_IN_MIGRATION)
        if len(rows) != len(fingerprints):
            # Redis cleanup must happen outside the SQL transaction.
            self.release_locks()
            raise UnmergeNeedsRecovery("Requested fingerprints no longer belong to the source")
        return fingerprints

    def check_ownership(self, fingerprints: Sequence[str]) -> None:
        if fingerprints and client().mget(
            [owner_key(self.args.project_id, fingerprint) for fingerprint in fingerprints]
        ) != [self.owner] * len(fingerprints):
            raise UnmergeNeedsRecovery("Unmerge fingerprint ownership is missing or has changed")

    def release_locks(self) -> None:
        fingerprints = sorted(set(self.args.replacement.primary_hashes_to_lock))
        if self.phase == "new":
            # No SQL locks were acquired by this operation.
            self.save("releasing", continuation=None)
        elif self.phase != "releasing":
            self.check_ownership(fingerprints)
            self.save("unlocking", continuation=None)
            GroupHash.objects.filter(
                project_id=self.args.project_id,
                hash__in=fingerprints,
                state=GroupHash.State.LOCKED_IN_MIGRATION,
            ).update(state=GroupHash.State.UNLOCKED)
            # Once owners start being released, retries must not unlock SQL:
            # a different operation may already have acquired a released hash.
            self.save("releasing")
        release_hashes(self.args.project_id, fingerprints, self.owner)
        self.complete()

    def begin_mutations(self) -> None:
        self.save("applying")

    def handoff(self, arguments: Mapping[str, Any]) -> None:
        self.save("handoff", continuation=arguments)

    def complete(self) -> None:
        self.save("complete", continuation=None)
