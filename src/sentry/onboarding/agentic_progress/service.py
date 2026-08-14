from __future__ import annotations

import hashlib
import hmac
import time
import uuid
from collections.abc import Callable
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import NamedTuple, cast

from django.conf import settings
from redis.exceptions import WatchError
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import json, redis

from .model import (
    InvalidOnboardingRun,
    OnboardingRun,
    OnboardingRunTerminal,
    ProgressUpdate,
    RunStatus,
    apply_update,
    initial_stages,
)

RUN_LIFETIME = timedelta(days=7)
"""Maximum lifetime of a registered onboarding run."""

CLIENT_CLAIM_RETRIES = 50
"""Maximum attempts to claim a browser run when concurrent registrations race."""

CLIENT_CLAIM_RETRY_DELAY = 0.01
"""Delay between client-run claim attempts while another registration initializes."""

ATOMIC_UPDATE_RETRIES = 50
"""Maximum attempts to update a run when concurrent Redis transactions race."""

TOKEN_LENGTH = 10
"""Length of the short handoff code included in the onboarding prompt."""


class RegisteredRun(NamedTuple):
    run: OnboardingRun
    onboarding_code: str


class UpdatedRun(NamedTuple):
    run: OnboardingRun
    changed: bool


class ClientRunClaim(NamedTuple):
    existing: OnboardingRun | None = None
    claimed_run_id: str | None = None


def get_redis_client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    return redis.redis_clusters.get_binary("default")


class RunNotFound(Exception):
    pass


class RunOwnershipMismatch(Exception):
    pass


class OnboardingProgressService:
    def __init__(self) -> None:
        self.redis = get_redis_client()
        self.signing_secret = settings.SECRET_KEY.encode()

    def create_or_resume(
        self,
        *,
        user_id: int,
        organization_id: int,
        client_run_id: str,
        onboarding_code: str,
    ) -> RegisteredRun:
        index_key = self._client_index_key(user_id, organization_id, client_run_id)
        claim = self._claim_client_run(index_key)
        if claim.existing is not None:
            if hmac.compare_digest(claim.existing.token_hash, self._hash_token(onboarding_code)):
                return RegisteredRun(claim.existing, onboarding_code)
            raise RunOwnershipMismatch

        assert claim.claimed_run_id is not None
        now = datetime.now(timezone.utc)
        ttl = int(RUN_LIFETIME.total_seconds())
        token_hash = self._hash_token(onboarding_code)
        token_key = self._token_index_key(token_hash)
        try:
            self._claim_token_index(token_key, claim.claimed_run_id, ttl)
            run = OnboardingRun(
                run_id=claim.claimed_run_id,
                channel_id=uuid.uuid4().hex,
                token_hash=token_hash,
                client_run_id=client_run_id,
                user_id=user_id,
                organization_id=organization_id,
                created_at=now,
                updated_at=now,
                expires_at=now + RUN_LIFETIME,
                sequence=0,
                stages=initial_stages(),
            )
            if not self.redis.set(
                self._state_key(claim.claimed_run_id), self._serialize(run), ex=ttl
            ):
                raise RuntimeError("Unable to store onboarding run")
        except Exception:
            self._release_index(token_key, claim.claimed_run_id)
            self._release_index(index_key, claim.claimed_run_id)
            raise

        return RegisteredRun(run, onboarding_code)

    def get(self, *, run_id: str, user_id: int, organization_id: int) -> OnboardingRun | None:
        run = self._load(self._state_key(run_id))
        if run is None or datetime.now(timezone.utc) >= run.expires_at:
            return None
        if run.user_id != user_id or run.organization_id != organization_id:
            return None
        return run

    def update(
        self,
        *,
        token: str,
        user_id: int,
        organization_id: int,
        update: ProgressUpdate,
    ) -> UpdatedRun:
        if len(token) != TOKEN_LENGTH or not token.isalnum():
            raise RunNotFound
        token_hash = self._hash_token(token)
        run_id = self._decode(self.redis.get(self._token_index_key(token_hash)))
        if run_id is None:
            raise RunNotFound

        def mutate(run: OnboardingRun) -> OnboardingRun:
            if run.token_hash != token_hash:
                raise RunNotFound
            if run.user_id != user_id or run.organization_id != organization_id:
                raise RunOwnershipMismatch
            return apply_update(run, update, datetime.now(timezone.utc))

        return self._atomic_update(run_id, mutate)

    def cancel(self, *, run_id: str, user_id: int, organization_id: int) -> OnboardingRun:
        def mutate(run: OnboardingRun) -> OnboardingRun:
            if run.user_id != user_id or run.organization_id != organization_id:
                raise RunNotFound
            if run.run_status is RunStatus.CANCELLED:
                return run
            if run.run_status is not RunStatus.ACTIVE:
                raise OnboardingRunTerminal("Onboarding run is terminal")
            now = datetime.now(timezone.utc)
            return replace(
                run,
                run_status=RunStatus.CANCELLED,
                updated_at=now,
                sequence=run.sequence + 1,
            )

        result = self._atomic_update(run_id, mutate)
        return result.run

    def _claim_client_run(self, index_key: str) -> ClientRunClaim:
        """Return the active indexed run or atomically claim the client id for a new run."""
        for attempt in range(CLIENT_CLAIM_RETRIES):
            try:
                with self.redis.pipeline() as pipeline:
                    pipeline.watch(index_key)
                    indexed_run_id = self._decode(cast(bytes | str | None, pipeline.get(index_key)))
                    if indexed_run_id is not None:
                        existing = self._load(self._state_key(indexed_run_id))
                        if existing is None and attempt < CLIENT_CLAIM_RETRIES - 1:
                            time.sleep(CLIENT_CLAIM_RETRY_DELAY)
                            continue
                        if (
                            existing is not None
                            and existing.run_status is RunStatus.ACTIVE
                            and datetime.now(timezone.utc) < existing.expires_at
                        ):
                            return ClientRunClaim(existing=existing)
                    claimed_run_id = uuid.uuid4().hex
                    pipeline.multi()
                    pipeline.set(
                        index_key,
                        claimed_run_id,
                        ex=int(RUN_LIFETIME.total_seconds()),
                    )
                    pipeline.execute()
                    return ClientRunClaim(claimed_run_id=claimed_run_id)
            except WatchError:
                continue

        raise RuntimeError("Unable to claim an onboarding client run")

    def _claim_token_index(self, key: str, run_id: str, ttl: int) -> None:
        for attempt in range(CLIENT_CLAIM_RETRIES):
            try:
                with self.redis.pipeline() as pipeline:
                    pipeline.watch(key)
                    indexed_run_id = self._decode(cast(bytes | str | None, pipeline.get(key)))
                    if indexed_run_id is not None:
                        existing = self._load(self._state_key(indexed_run_id))
                        if existing is None and attempt < CLIENT_CLAIM_RETRIES - 1:
                            time.sleep(CLIENT_CLAIM_RETRY_DELAY)
                            continue
                        if (
                            existing is not None
                            and existing.run_status is RunStatus.ACTIVE
                            and datetime.now(timezone.utc) < existing.expires_at
                        ):
                            raise ValueError("Onboarding code is already in use")

                    pipeline.multi()
                    pipeline.set(key, run_id, ex=ttl)
                    pipeline.execute()
                    return
            except WatchError:
                continue

        raise RuntimeError("Unable to claim onboarding code")

    def _release_index(self, key: str, run_id: str) -> None:
        for _ in range(CLIENT_CLAIM_RETRIES):
            try:
                with self.redis.pipeline() as pipeline:
                    pipeline.watch(key)
                    indexed_run_id = self._decode(cast(bytes | str | None, pipeline.get(key)))
                    if indexed_run_id != run_id:
                        return

                    pipeline.multi()
                    pipeline.delete(key)
                    pipeline.execute()
                    return
            except WatchError:
                continue

        raise RuntimeError("Unable to release onboarding index")

    def _atomic_update(
        self, run_id: str, mutate: Callable[[OnboardingRun], OnboardingRun]
    ) -> UpdatedRun:
        key = self._state_key(run_id)
        for _ in range(ATOMIC_UPDATE_RETRIES):
            try:
                with self.redis.pipeline() as pipeline:
                    pipeline.watch(key)
                    raw = cast(bytes | str | None, pipeline.get(key))
                    if raw is None:
                        raise RunNotFound
                    current = self._deserialize(raw)
                    updated = mutate(current)
                    if updated == current:
                        return UpdatedRun(current, False)

                    pipeline.multi()
                    pipeline.set(key, self._serialize(updated), ex=self._remaining_ttl(updated))
                    pipeline.execute()
                    return UpdatedRun(updated, True)
            except WatchError:
                continue

        raise RuntimeError("Unable to update onboarding progress")

    def _remaining_ttl(self, run: OnboardingRun) -> int:
        remaining = run.expires_at - datetime.now(timezone.utc)
        if remaining.total_seconds() <= 0:
            raise RunNotFound
        return max(1, int(remaining.total_seconds()))

    def _hash_token(self, token: str) -> str:
        # The handoff code is intentionally short enough to paste into a prompt, which
        # also makes it practical to enumerate. A keyed digest avoids storing the raw
        # code and prevents a Redis snapshot alone from validating offline guesses.
        return hmac.new(self.signing_secret, token.encode(), hashlib.sha256).hexdigest()

    def _load(self, key: str) -> OnboardingRun | None:
        raw = self.redis.get(key)
        if raw is None:
            return None

        try:
            return self._deserialize(raw)
        except RunNotFound:
            return None

    @staticmethod
    def _state_key(run_id: str) -> str:
        return f"agentic-onboarding:run:{{{run_id}}}:state"

    @staticmethod
    def _token_index_key(token_hash: str) -> str:
        return f"agentic-onboarding:token:{token_hash}"

    @staticmethod
    def _client_index_key(user_id: int, organization_id: int, client_run_id: str) -> str:
        digest = hashlib.sha256(client_run_id.encode()).hexdigest()
        return f"agentic-onboarding:client:{organization_id}:{user_id}:{digest}"

    @staticmethod
    def _serialize(run: OnboardingRun) -> str:
        return json.dumps(run.to_dict())

    @staticmethod
    def _deserialize(raw: bytes | str) -> OnboardingRun:
        try:
            return OnboardingRun.from_dict(json.loads(raw))
        except (json.JSONDecodeError, InvalidOnboardingRun, TypeError) as error:
            raise RunNotFound from error

    @staticmethod
    def _decode(value: bytes | str | None) -> str | None:
        return value.decode() if isinstance(value, bytes) else value


def get_onboarding_progress_service() -> OnboardingProgressService:
    return OnboardingProgressService()
