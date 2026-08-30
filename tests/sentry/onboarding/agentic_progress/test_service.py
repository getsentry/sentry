from collections.abc import Iterator
from dataclasses import replace
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import patch

import pytest
from django.utils import timezone as django_timezone
from redis.exceptions import WatchError

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


@pytest.fixture
def frozen_time() -> Iterator[Any]:
    with freeze_time("2020-01-01T00:00:00Z") as frozen:
        yield frozen


@pytest.fixture
def service(frozen_time: Any) -> Iterator[OnboardingProgressService]:
    yield OnboardingProgressService()


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

    with patch.object(service.redis, "pipeline") as pipeline:
        active_pipeline = pipeline.return_value.__enter__.return_value
        active_pipeline.get.return_value = service._serialize(created)
        active_pipeline.execute.side_effect = WatchError
        with pytest.raises(RuntimeError, match="Unable to update onboarding progress"):
            service.cancel(run_id=created.run_id, user_id=1, organization_id=2)

    assert pipeline.call_count == ATOMIC_UPDATE_RETRIES
