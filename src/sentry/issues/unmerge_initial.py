from __future__ import annotations

import time
from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from dataclasses import asdict, dataclass, field
from typing import Any, Literal
from uuid import uuid4

from django.conf import settings
from redis.client import StrictRedis
from sentry_redis_tools.clients import RedisCluster
from taskbroker_client.retry import RetryTaskError

from sentry import options
from sentry.models.grouphash import GroupHash
from sentry.utils import json, redis

LEASE_SECONDS = 600
save_checkpoint = redis.load_redis_script("issues/unmerge/save_checkpoint.lua")
release_owner = redis.load_redis_script("issues/unmerge/release_owner.lua")
promote_owner = redis.load_redis_script("issues/unmerge/promote_owner.lua")


class InitialUnmergeBusy(RetryTaskError):
    pass


class InitialUnmergeOwnershipLost(Exception):
    pass


class InitialUnmergeNeedsRecovery(Exception):
    """A first batch may have mutated data; repeating it could duplicate aggregates."""


@dataclass
class InitialUnmergeState:
    project_id: int
    source_id: int
    fingerprints: list[str]
    expires_at: int
    phase: Literal[
        "preparing", "locked", "processing", "finishing", "continuing", "complete", "needs_recovery"
    ] = "preparing"
    hashes: dict[str, int] = field(default_factory=dict)
    continuation: dict[str, Any] | None = None


def get_client() -> RedisCluster[str] | StrictRedis[str]:
    return redis.redis_clusters.get(settings.SENTRY_UNMERGE_RECOVERY_REDIS_CLUSTER)


def checkpoint_key(project_id: int, operation_id: str) -> str:
    return f"unmerge:{{{project_id}}}:initial:{operation_id}"


def hash_owner_key(project_id: int, fingerprint: str) -> str:
    return f"unmerge:{{{project_id}}}:initial-owner:{fingerprint}"


@contextmanager
def reserve_hashes(
    project_id: int, source_id: int, fingerprints: Sequence[str]
) -> Iterator[list[str]]:
    client = get_client()
    token = f"legacy:{uuid4().hex}"
    reserved = []
    try:
        rows = GroupHash.objects.filter(
            project_id=project_id, group_id=source_id, hash__in=fingerprints
        ).exclude(state=GroupHash.State.LOCKED_IN_MIGRATION)
        for row in rows:
            if client.set(hash_owner_key(project_id, row.hash), token, nx=True, ex=LEASE_SECONDS):
                reserved.append(row.hash)
        yield reserved
    finally:
        for fingerprint in reserved:
            release_owner((hash_owner_key(project_id, fingerprint),), (token,), client)


class InitialUnmergeCheckpoint:
    def __init__(
        self,
        client: RedisCluster[str] | StrictRedis[str],
        operation_id: str,
        token: str,
        state: InitialUnmergeState,
    ) -> None:
        self.client = client
        self.operation_id = operation_id
        self.token = token
        self.state = state
        self.key = checkpoint_key(state.project_id, operation_id)
        self.lease = f"{self.key}:lease"

    @classmethod
    @contextmanager
    def acquire(
        cls, project_id: int, source_id: int, operation_id: str, fingerprints: Sequence[str]
    ) -> Iterator[InitialUnmergeCheckpoint]:
        client = get_client()
        key = checkpoint_key(project_id, operation_id)
        lease = f"{key}:lease"
        token = uuid4().hex
        ttl = options.get("unmerge.initial-checkpoint-ttl")
        if ttl <= LEASE_SECONDS:
            raise ValueError("Unmerge checkpoint retention must outlive the worker lease")
        if not client.set(lease, token, nx=True, ex=LEASE_SECONDS):
            raise InitialUnmergeBusy()
        try:
            saved = client.get(key)
            if saved is None:
                state = InitialUnmergeState(
                    project_id, source_id, list(fingerprints), int(time.time()) + ttl
                )
                if not client.set(key, json.dumps(asdict(state)), nx=True, ex=ttl):
                    raise InitialUnmergeOwnershipLost()
            else:
                state = InitialUnmergeState(**json.loads(saved))
                if (
                    state.project_id != project_id
                    or state.source_id != source_id
                    or set(state.fingerprints) != set(fingerprints)
                ):
                    raise ValueError("Unmerge checkpoint does not match the task")
            yield cls(client, operation_id, token, state)
        finally:
            release_owner((lease,), (token,), client)

    def save(self) -> None:
        remaining = self.state.expires_at - int(time.time())
        if remaining <= 0 or not save_checkpoint(
            (self.key, self.lease),
            (self.token, json.dumps(asdict(self.state)), remaining),
            self.client,
        ):
            raise InitialUnmergeOwnershipLost()

    def lock_hashes(self) -> list[str]:
        if self.state.phase == "preparing":
            hash_ids: dict[str, int] = {}
            pending = f"pending:{self.operation_id}"
            reservations: dict[str, str] = {}
            rows = GroupHash.objects.filter(
                project_id=self.state.project_id,
                group_id=self.state.source_id,
                hash__in=self.state.fingerprints,
            ).order_by("id")
            for row in rows:
                key = hash_owner_key(self.state.project_id, row.hash)
                owner = self.client.get(key)
                if owner not in (self.operation_id, pending) and not self.client.set(
                    key, pending, nx=True, ex=self.state.expires_at - int(time.time())
                ):
                    continue
                reservations[row.hash] = (
                    self.operation_id if owner == self.operation_id else pending
                )

            # Re-read SQL after reserving. A legacy task can lock a row and release its Redis
            # reservation between our first query and SET NX. A pending reservation proves no
            # ownership of an existing SQL lock, even after this operation is retried.
            rows = GroupHash.objects.filter(
                project_id=self.state.project_id,
                group_id=self.state.source_id,
                hash__in=reservations,
            ).order_by("id")
            for row in rows:
                if reservations[row.hash] == pending:
                    if row.state == GroupHash.State.LOCKED_IN_MIGRATION:
                        continue
                    if not promote_owner(
                        (hash_owner_key(self.state.project_id, row.hash), self.lease),
                        (
                            pending,
                            self.operation_id,
                            self.token,
                            self.state.expires_at - int(time.time()),
                        ),
                        self.client,
                    ):
                        raise InitialUnmergeOwnershipLost()
                hash_ids[row.hash] = row.id
            self.state.hashes = hash_ids
            self.state.phase = "locked"
            # Redis intent survives a SQL rollback. Reservations prevent another operation from
            # claiming a hash if this SQL write fails or is interrupted.
            self.save()

        hashes = self.owned_hashes()
        self.save()
        # Include this operation's existing SQL locks, even when a retry has a new activation ID.
        GroupHash.objects.filter(
            project_id=self.state.project_id,
            group_id=self.state.source_id,
            id__in=self.state.hashes.values(),
        ).exclude(state=GroupHash.State.LOCKED_IN_MIGRATION).update(
            state=GroupHash.State.LOCKED_IN_MIGRATION
        )
        return hashes

    def owned_hashes(self) -> list[str]:
        rows = list(
            GroupHash.objects.filter(
                project_id=self.state.project_id,
                group_id=self.state.source_id,
                id__in=self.state.hashes.values(),
            )
        )
        if len(rows) != len(self.state.hashes):
            raise InitialUnmergeOwnershipLost()
        for row in rows:
            if (
                row.hash not in self.state.hashes
                or self.client.get(hash_owner_key(self.state.project_id, row.hash))
                != self.operation_id
            ):
                raise InitialUnmergeOwnershipLost()
        return list(self.state.hashes)

    def begin_processing(self) -> None:
        self.state.phase = "processing"
        self.save()

    def begin_finishing(self) -> None:
        self.state.phase = "finishing"
        self.save()

    def continue_with(self, arguments: Mapping[str, Any]) -> None:
        self.state.continuation = dict(arguments)
        self.state.phase = "continuing"
        self.save()
        self.release_reservations()

    def release_reservations(self) -> None:
        for fingerprint in self.state.fingerprints:
            release_owner(
                (hash_owner_key(self.state.project_id, fingerprint),),
                (self.operation_id,),
                self.client,
            )
            release_owner(
                (hash_owner_key(self.state.project_id, fingerprint),),
                (f"pending:{self.operation_id}",),
                self.client,
            )

    def complete(self) -> None:
        self.state.phase = "complete"
        self.save()
        self.release_reservations()

    def continuation_arguments(self) -> dict[str, Any]:
        assert self.state.continuation is not None
        # Argument parsing consumes the replacement discriminator in eager tasks/tests.
        return json.loads(json.dumps(self.state.continuation))
