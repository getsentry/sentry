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
    phase: Literal["preparing", "locked", "processing", "finishing", "continuing", "complete"] = (
        "preparing"
    )
    hashes: dict[str, int] = field(default_factory=dict)
    continuation: dict[str, Any] | None = None


def get_client() -> RedisCluster[str] | StrictRedis[str]:
    return redis.redis_clusters.get(settings.SENTRY_UNMERGE_RECOVERY_REDIS_CLUSTER)


def checkpoint_key(project_id: int, activation_id: str) -> str:
    return f"unmerge:{{{project_id}}}:initial:{activation_id}"


def hash_owner_key(project_id: int, fingerprint: str) -> str:
    return f"unmerge:{{{project_id}}}:initial-owner:{fingerprint}"


def claim_first_continuation(project_id: int, parent_id: str, activation_id: str) -> bool:
    client = get_client()
    key = f"{checkpoint_key(project_id, parent_id)}:first-child"
    if client.set(key, activation_id, nx=True, ex=options.get("unmerge.initial-checkpoint-ttl")):
        return True
    return client.get(key) == activation_id


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
        activation_id: str,
        token: str,
        state: InitialUnmergeState,
    ) -> None:
        self.client = client
        self.activation_id = activation_id
        self.token = token
        self.state = state
        self.key = checkpoint_key(state.project_id, activation_id)
        self.lease = f"{self.key}:lease"

    @classmethod
    @contextmanager
    def acquire(
        cls, project_id: int, source_id: int, activation_id: str, fingerprints: Sequence[str]
    ) -> Iterator[InitialUnmergeCheckpoint]:
        client = get_client()
        key = checkpoint_key(project_id, activation_id)
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
                client.set(key, json.dumps(asdict(state)), ex=ttl)
            else:
                state = InitialUnmergeState(**json.loads(saved))
                if (
                    state.project_id != project_id
                    or state.source_id != source_id
                    or set(state.fingerprints) != set(fingerprints)
                ):
                    raise ValueError("Unmerge checkpoint does not match the task")
            yield cls(client, activation_id, token, state)
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
            rows = GroupHash.objects.filter(
                project_id=self.state.project_id,
                group_id=self.state.source_id,
                hash__in=self.state.fingerprints,
            ).order_by("id")
            for row in rows:
                key = hash_owner_key(self.state.project_id, row.hash)
                owner = self.client.get(key)
                if row.state == GroupHash.State.LOCKED_IN_MIGRATION and owner != self.activation_id:
                    continue
                if owner != self.activation_id and not self.client.set(
                    key, self.activation_id, nx=True, ex=self.state.expires_at - int(time.time())
                ):
                    continue
                hash_ids[row.hash] = row.id
            self.state.hashes = hash_ids
            self.state.phase = "locked"
            # Write-ahead intent, outside SQL transactions. Redis reservations prevent another
            # initial activation from claiming a hash if this SQL write fails or is interrupted.
            self.save()

        hashes = self.owned_hashes()
        self.save()
        # This is idempotent on redelivery: include this activation's existing SQL locks.
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
                != self.activation_id
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
                (self.activation_id,),
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
