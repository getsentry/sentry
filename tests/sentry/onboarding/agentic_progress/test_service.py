from collections.abc import Iterator
from dataclasses import replace
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import patch

import pytest
from django.utils import timezone as django_timezone

from sentry.onboarding.agentic_progress.model import (
    OnboardingRunTerminal,
    ProgressUpdate,
    RunStatus,
    Stage,
    StageStatus,
)
from sentry.onboarding.agentic_progress.service import (
    ATOMIC_UPDATE_RETRIES,
    CLIENT_CLAIM_RETRIES,
    RUN_LIFETIME,
    OnboardingProgressService,
    RegisteredRun,
    RunNotFound,
    RunOwnershipMismatch,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.redis import use_redis_cluster
from sentry.utils import redis


@pytest.fixture
def frozen_time() -> Iterator[Any]:
    with freeze_time("2020-01-01T00:00:00Z") as frozen:
        yield frozen


@pytest.fixture(params=["single", "cluster"])
def service(
    request: pytest.FixtureRequest, frozen_time: Any
) -> Iterator[OnboardingProgressService]:
    if request.param == "single":
        yield OnboardingProgressService()
        return

    # The service must also work when `default` is a Redis cluster, which does not
    # support WATCH/MULTI. Use a different cluster name so that the cached `default`
    # client stays a single host for other tests.
    with use_redis_cluster("agentic-onboarding"):
        service = OnboardingProgressService()
        service.redis = redis.redis_clusters.get_binary("agentic-onboarding")
        service.redis.flushall()
        try:
            yield service
        finally:
            redis.redis_clusters._clusters_bytes.pop("agentic-onboarding", None)


def create_run(
    service: OnboardingProgressService,
    *,
    user_id: int,
    organization_id: int,
    client_run_id: str,
    onboarding_code: str = "abcdefghij",
) -> RegisteredRun:
    return service.create_or_resume(
        user_id=user_id,
        organization_id=organization_id,
        client_run_id=client_run_id,
        onboarding_code=onboarding_code,
    )


def test_create_get_and_resume(service: OnboardingProgressService) -> None:
    created, token = create_run(
        service, user_id=1, organization_id=2, client_run_id="browser-session"
    )
    fetched = service.get(run_id=created.run_id, user_id=1, organization_id=2)
    resumed, resumed_token = create_run(
        service, user_id=1, organization_id=2, client_run_id="browser-session"
    )

    assert token == "abcdefghij"
    assert len(created.channel_id) == 32
    assert fetched == created
    assert resumed.run_id == created.run_id
    assert resumed_token == token
    assert service.get(run_id=created.run_id, user_id=9, organization_id=2) is None


def test_resume_preserves_supplied_onboarding_code(service: OnboardingProgressService) -> None:
    created, token = create_run(
        service, user_id=1, organization_id=2, client_run_id="browser-session"
    )

    resumed, resumed_token = create_run(
        service,
        user_id=1,
        organization_id=2,
        client_run_id="browser-session",
        onboarding_code=token,
    )

    assert resumed == created
    assert resumed_token == token


def test_resume_rejects_a_different_onboarding_code(service: OnboardingProgressService) -> None:
    create_run(service, user_id=1, organization_id=2, client_run_id="browser-session")

    with pytest.raises(RunOwnershipMismatch):
        create_run(
            service,
            user_id=1,
            organization_id=2,
            client_run_id="browser-session",
            onboarding_code="klmnopqrst",
        )


def test_update_uses_canonical_state_key(service: OnboardingProgressService) -> None:
    created, token = create_run(
        service, user_id=1, organization_id=2, client_run_id="browser-session"
    )

    updated, changed, _ = service.update(
        token=token,
        user_id=1,
        organization_id=2,
        update=ProgressUpdate(stage=Stage.CREATE_PROJECT, status=StageStatus.COMPLETED),
    )

    stored = service.redis.get(f"agentic-onboarding:run:{{{created.run_id}}}:state")
    assert stored is not None
    assert updated.sequence == 1
    assert changed is True


def test_duplicate_update_is_idempotent(service: OnboardingProgressService) -> None:
    _, token = create_run(service, user_id=1, organization_id=2, client_run_id="browser-session")
    first, first_changed, _ = service.update(
        token=token,
        user_id=1,
        organization_id=2,
        update=ProgressUpdate(stage=Stage.CONNECT_MCP, status=StageStatus.COMPLETED),
    )
    duplicate, duplicate_changed, _ = service.update(
        token=token,
        user_id=1,
        organization_id=2,
        update=ProgressUpdate(stage=Stage.CONNECT_MCP, status=StageStatus.COMPLETED),
    )

    assert duplicate == first
    assert duplicate.sequence == 1
    assert first_changed is True
    assert duplicate_changed is False


def test_token_and_ownership_are_validated(service: OnboardingProgressService) -> None:
    _, token = create_run(service, user_id=1, organization_id=2, client_run_id="browser-session")

    with pytest.raises(RunNotFound):
        service.update(
            token="invalid000",
            user_id=1,
            organization_id=2,
            update=ProgressUpdate(stage=Stage.CONNECT_MCP, status=StageStatus.COMPLETED),
        )
    with pytest.raises(RunOwnershipMismatch):
        service.update(
            token=token,
            user_id=9,
            organization_id=2,
            update=ProgressUpdate(stage=Stage.CONNECT_MCP, status=StageStatus.COMPLETED),
        )


def test_cancel_is_terminal_and_idempotent(service: OnboardingProgressService) -> None:
    created, _ = create_run(service, user_id=1, organization_id=2, client_run_id="browser-session")

    cancelled = service.cancel(run_id=created.run_id, user_id=1, organization_id=2)
    replay = service.cancel(run_id=created.run_id, user_id=1, organization_id=2)

    assert cancelled.run_status is RunStatus.CANCELLED
    assert replay == cancelled


def test_cancel_rejects_completed_run(service: OnboardingProgressService) -> None:
    created, token = create_run(
        service, user_id=1, organization_id=2, client_run_id="browser-session"
    )
    service.update(
        token=token,
        user_id=1,
        organization_id=2,
        update=ProgressUpdate(
            stage=Stage.CHECK_STACK_TRACE_QUALITY,
            status=StageStatus.SKIPPED,
            run_status=RunStatus.COMPLETED,
        ),
    )

    with pytest.raises(OnboardingRunTerminal):
        service.cancel(run_id=created.run_id, user_id=1, organization_id=2)


def test_expiration_is_absolute(service: OnboardingProgressService, frozen_time: Any) -> None:
    created, token = create_run(
        service, user_id=1, organization_id=2, client_run_id="browser-session"
    )
    frozen_time.shift(RUN_LIFETIME - timedelta(hours=1))
    service.update(
        token=token,
        user_id=1,
        organization_id=2,
        update=ProgressUpdate(stage=Stage.CONNECT_MCP, status=StageStatus.COMPLETED),
    )

    state_key = f"agentic-onboarding:run:{{{created.run_id}}}:state"
    assert service.redis.ttl(state_key) == int(timedelta(hours=1).total_seconds())

    frozen_time.shift(timedelta(hours=1))
    assert service.get(run_id=created.run_id, user_id=1, organization_id=2) is None
    with pytest.raises(ValueError, match="expired"):
        service.update(
            token=token,
            user_id=1,
            organization_id=2,
            update=ProgressUpdate(stage=Stage.ANALYZE_PROJECT, status=StageStatus.COMPLETED),
        )


def test_new_run_uses_one_week_ttl(service: OnboardingProgressService) -> None:
    created, _ = create_run(service, user_id=1, organization_id=2, client_run_id="browser-session")
    assert service.redis.ttl(f"agentic-onboarding:run:{{{created.run_id}}}:state") == int(
        RUN_LIFETIME.total_seconds()
    )


def test_create_replaces_application_expired_run_retained_in_redis(
    service: OnboardingProgressService, frozen_time: Any
) -> None:
    expired, _ = create_run(service, user_id=1, organization_id=2, client_run_id="browser-session")
    expired_state_key = f"agentic-onboarding:run:{{{expired.run_id}}}:state"
    retained = replace(expired, expires_at=expired.expires_at - RUN_LIFETIME)
    service.redis.set(
        expired_state_key, service._serialize(retained), ex=int(RUN_LIFETIME.total_seconds())
    )

    assert service.redis.get(expired_state_key) is not None

    created, token = create_run(
        service, user_id=1, organization_id=2, client_run_id="browser-session"
    )

    assert created.run_id != expired.run_id
    assert created.created_at == django_timezone.now()
    assert token == "abcdefghij"


def test_registration_failure_releases_claimed_indexes(
    service: OnboardingProgressService,
) -> None:
    original_set = service.redis.set

    def fail_state_write(key: str, *args: Any, **kwargs: Any) -> Any:
        if key.endswith(":state"):
            raise RuntimeError("write failed")
        return original_set(key, *args, **kwargs)

    with patch.object(service.redis, "set", side_effect=fail_state_write):
        with pytest.raises(RuntimeError, match="write failed"):
            create_run(service, user_id=1, organization_id=2, client_run_id="browser-session")

    token_key = service._token_index_key(service._hash_token("abcdefghij"))
    client_key = service._client_index_key(1, 2, "browser-session")
    assert service.redis.get(token_key) is None
    assert service.redis.get(client_key) is None


def test_index_cleanup_does_not_delete_a_new_owner(service: OnboardingProgressService) -> None:
    key = service._token_index_key(service._hash_token("abcdefghij"))
    service.redis.set(key, "winning-run")

    service._release_index(key, "losing-run")

    assert service.redis.get(key) == b"winning-run"


def test_token_claim_waits_for_registration_state(service: OnboardingProgressService) -> None:
    key = service._token_index_key(service._hash_token("abcdefghij"))
    service.redis.set(key, "registering-run")

    with (
        patch.object(service, "_load", return_value=None) as load,
        patch("sentry.onboarding.agentic_progress.service.time.sleep") as sleep,
    ):
        service._claim_token_index(key, "competing-run", 60)

    assert load.call_count == CLIENT_CLAIM_RETRIES
    assert sleep.call_count == CLIENT_CLAIM_RETRIES - 1
    assert service.redis.get(key) == b"competing-run"


def test_redis_round_trip_preserves_datetime_fields(service: OnboardingProgressService) -> None:
    created, _ = create_run(service, user_id=1, organization_id=2, client_run_id="browser-session")

    restored = service.get(run_id=created.run_id, user_id=1, organization_id=2)

    assert restored is not None
    assert isinstance(restored.created_at, datetime)
    assert isinstance(restored.updated_at, datetime)
    assert isinstance(restored.expires_at, datetime)


def test_corrupted_state_is_treated_as_missing(service: OnboardingProgressService) -> None:
    created, token = create_run(
        service, user_id=1, organization_id=2, client_run_id="browser-session"
    )
    service.redis.set(f"agentic-onboarding:run:{{{created.run_id}}}:state", b"not-json")

    assert service.get(run_id=created.run_id, user_id=1, organization_id=2) is None
    with pytest.raises(RunNotFound):
        service.update(
            token=token,
            user_id=1,
            organization_id=2,
            update=ProgressUpdate(stage=Stage.CONNECT_MCP, status=StageStatus.COMPLETED),
        )


def test_atomic_update_bounds_contention_retries(service: OnboardingProgressService) -> None:
    created, _ = create_run(service, user_id=1, organization_id=2, client_run_id="browser-session")

    with patch.object(service, "_compare_and_set", return_value=False) as compare_and_set:
        with pytest.raises(RuntimeError, match="Unable to update onboarding progress"):
            service.cancel(run_id=created.run_id, user_id=1, organization_id=2)

    assert compare_and_set.call_count == ATOMIC_UPDATE_RETRIES
    stored = service.get(run_id=created.run_id, user_id=1, organization_id=2)
    assert stored is not None
    assert stored.run_status is RunStatus.ACTIVE


def test_atomic_update_retries_after_a_concurrent_write(
    service: OnboardingProgressService,
) -> None:
    created, token = create_run(
        service, user_id=1, organization_id=2, client_run_id="browser-session"
    )
    state_key = service._state_key(created.run_id)
    original_deserialize = service._deserialize
    reads = 0

    def deserialize_then_race(raw: bytes | str) -> Any:
        nonlocal reads
        reads += 1
        current = original_deserialize(raw)
        if reads == 1:
            # Another writer lands between this read and the compare-and-set.
            competing = replace(current, sequence=current.sequence + 5)
            service.redis.set(state_key, service._serialize(competing), ex=60)
        return current

    with patch.object(service, "_deserialize", side_effect=deserialize_then_race):
        updated, changed, _ = service.update(
            token=token,
            user_id=1,
            organization_id=2,
            update=ProgressUpdate(stage=Stage.CONNECT_MCP, status=StageStatus.COMPLETED),
        )

    assert reads == 2
    assert changed is True
    # The retry applied the update on top of the competing write.
    assert updated.sequence == 6
    stored = service.get(run_id=created.run_id, user_id=1, organization_id=2)
    assert stored == updated


def test_client_claim_retries_after_a_concurrent_claim(
    service: OnboardingProgressService,
) -> None:
    winner, _ = create_run(service, user_id=1, organization_id=2, client_run_id="browser-session")
    index_key = service._client_index_key(1, 2, "browser-session")
    original_get = service.redis.get
    stale_reads = 0

    def stale_first_read(key: str) -> Any:
        nonlocal stale_reads
        if key == index_key and stale_reads == 0:
            # Simulate a read that happened before the winner claimed the key.
            stale_reads += 1
            return None
        return original_get(key)

    with patch.object(service.redis, "get", side_effect=stale_first_read):
        claim = service._claim_client_run(index_key)

    assert stale_reads == 1
    assert claim.claimed_run_id is None
    assert claim.existing == winner
    assert service.redis.get(index_key) == winner.run_id.encode()


def test_token_claim_rejects_an_active_owner(service: OnboardingProgressService) -> None:
    create_run(service, user_id=1, organization_id=2, client_run_id="browser-session")
    key = service._token_index_key(service._hash_token("abcdefghij"))
    owner = service.redis.get(key)

    with pytest.raises(ValueError, match="already in use"):
        service._claim_token_index(key, "competing-run", 60)

    assert service.redis.get(key) == owner


def test_token_claim_takes_over_a_finished_owner(service: OnboardingProgressService) -> None:
    created, _ = create_run(service, user_id=1, organization_id=2, client_run_id="browser-session")
    service.cancel(run_id=created.run_id, user_id=1, organization_id=2)
    key = service._token_index_key(service._hash_token("abcdefghij"))

    service._claim_token_index(key, "next-run", 60)

    assert service.redis.get(key) == b"next-run"
    assert service.redis.ttl(key) == 60


def test_release_index_deletes_own_claim(service: OnboardingProgressService) -> None:
    key = service._token_index_key(service._hash_token("abcdefghij"))
    service.redis.set(key, "owning-run")

    service._release_index(key, "owning-run")
    service._release_index(key, "owning-run")

    assert service.redis.get(key) is None


def test_compare_and_set(service: OnboardingProgressService) -> None:
    key = "agentic-onboarding:test:compare-and-set"
    service.redis.delete(key)

    assert service._compare_and_set(key, None, "first", 30) is True
    assert service.redis.get(key) == b"first"
    assert service.redis.ttl(key) == 30

    # The key exists, so a writer that expected it to be absent loses.
    assert service._compare_and_set(key, None, "second", 30) is False
    # A stale expected value loses.
    assert service._compare_and_set(key, b"stale", "second", 30) is False
    assert service.redis.get(key) == b"first"

    assert service._compare_and_set(key, b"first", "second", 90) is True
    assert service.redis.get(key) == b"second"
    assert service.redis.ttl(key) == 90

    service.redis.delete(key)
    # The key is gone, so a writer that expected a value loses.
    assert service._compare_and_set(key, b"second", "third", 30) is False
    assert service.redis.get(key) is None
