import logging
from collections.abc import Callable
from time import time
from typing import TypedDict

from django.conf import settings
from redis.exceptions import RedisError

from sentry import ratelimits
from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.errors import SCMCodedError, SCMError, SCMUnhandledException
from sentry.scm.private.ipc import record_count_metric
from sentry.scm.private.provider import Provider
from sentry.scm.private.providers.github import GitHubProvider
from sentry.scm.private.providers.gitlab import GitLabProvider
from sentry.scm.types import ExternalId, ProviderName, Referrer, Repository, RepositoryId
from sentry.utils import json, metrics, redis

logger = logging.getLogger(__name__)

SCM_GITHUB_RATE_LIMIT_WINDOW = 3600
SCM_GITHUB_RATE_LIMIT_GRACE = 60
SCM_GITHUB_RATE_LIMIT_FALLBACK_TOTAL = 5000


class GitHubRateLimitState(TypedDict):
    limit: int
    remaining: int
    used: int
    reset: int
    window_start: int
    window_end: int
    observed: bool


def is_rate_limited(
    organization_id: int,
    referrer: Referrer,
    provider: str,
    limit: int,
    window: int,
) -> bool:
    return ratelimits.backend.is_limited(
        f"scm_platform.{organization_id}.{referrer}.{provider}", limit=limit, window=window
    )


def _get_scm_rate_limit_redis():
    return redis.redis_clusters.get(settings.SENTRY_RATE_LIMIT_REDIS_CLUSTER)


def _get_github_rate_limit_state_key(organization_id: int) -> str:
    return f"scm_platform.github.rate_limit_state.{organization_id}"


def _get_github_rate_limit_counter_key(
    organization_id: int, reset: int, provider: str, pool: str
) -> str:
    return f"scm_platform.{provider}.{organization_id}.{reset}.{pool}"


def get_fallback_github_rate_limit_state(
    now: float | None = None,
    fallback_limit: int = SCM_GITHUB_RATE_LIMIT_FALLBACK_TOTAL,
) -> GitHubRateLimitState:
    if now is None:
        now = time()

    current_timestamp = int(now)
    window_end = (
        (current_timestamp // SCM_GITHUB_RATE_LIMIT_WINDOW) + 1
    ) * SCM_GITHUB_RATE_LIMIT_WINDOW

    return {
        "limit": fallback_limit,
        "remaining": fallback_limit,
        "used": 0,
        "reset": window_end,
        "window_start": max(window_end - SCM_GITHUB_RATE_LIMIT_WINDOW, 0),
        "window_end": window_end,
        "observed": False,
    }


def get_github_rate_limit_state(
    organization_id: int, now: float | None = None
) -> GitHubRateLimitState | None:
    if now is None:
        now = time()

    try:
        raw_state = _get_scm_rate_limit_redis().get(
            _get_github_rate_limit_state_key(organization_id)
        )
    except RedisError:
        logger.exception("Failed to fetch SCM GitHub rate-limit state from redis")
        return None

    if raw_state is None:
        return None

    try:
        state = json.loads(raw_state)
    except (TypeError, ValueError):
        logger.warning(
            "Invalid SCM GitHub rate-limit state payload",
            extra={"organization_id": organization_id},
        )
        return None

    if int(state["window_end"]) <= int(now):
        try:
            _get_scm_rate_limit_redis().delete(_get_github_rate_limit_state_key(organization_id))
        except RedisError:
            logger.exception("Failed to delete stale SCM GitHub rate-limit state from redis")
        return None

    return {
        "limit": int(state["limit"]),
        "remaining": int(state["remaining"]),
        "used": int(state["used"]),
        "reset": int(state["reset"]),
        "window_start": int(state["window_start"]),
        "window_end": int(state["window_end"]),
        "observed": bool(state.get("observed", True)),
    }


def get_effective_github_rate_limit_state(
    organization_id: int,
    now: float | None = None,
    fallback_limit: int = SCM_GITHUB_RATE_LIMIT_FALLBACK_TOTAL,
) -> GitHubRateLimitState:
    state = get_github_rate_limit_state(organization_id, now=now)
    if state is not None:
        return state

    metrics.incr("sentry.scm.github.rate_limit.fallback_state_used")
    return get_fallback_github_rate_limit_state(now=now, fallback_limit=fallback_limit)


def update_github_rate_limit_state(
    organization_id: int,
    headers: dict[str, str] | None,
    now: float | None = None,
) -> GitHubRateLimitState | None:
    if not headers:
        return None

    limit = headers.get("X-RateLimit-Limit")
    remaining = headers.get("X-RateLimit-Remaining")
    reset = headers.get("X-RateLimit-Reset")
    used = headers.get("X-RateLimit-Used")

    if limit is None or remaining is None or reset is None:
        return None

    if now is None:
        now = time()

    try:
        parsed_limit = int(limit)
        parsed_remaining = int(remaining)
        parsed_reset = int(reset)
        parsed_used = int(used) if used is not None else max(parsed_limit - parsed_remaining, 0)
    except ValueError:
        logger.warning(
            "Invalid SCM GitHub rate-limit headers",
            extra={"organization_id": organization_id, "headers": headers},
        )
        return None

    state: GitHubRateLimitState = {
        "limit": parsed_limit,
        "remaining": parsed_remaining,
        "used": parsed_used,
        "reset": parsed_reset,
        "window_start": max(parsed_reset - SCM_GITHUB_RATE_LIMIT_WINDOW, 0),
        "window_end": parsed_reset,
        "observed": True,
    }

    ttl = max(parsed_reset - int(now), 1) + SCM_GITHUB_RATE_LIMIT_GRACE
    try:
        _get_scm_rate_limit_redis().setex(
            _get_github_rate_limit_state_key(organization_id), ttl, json.dumps(state)
        )
    except RedisError:
        logger.exception("Failed to persist SCM GitHub rate-limit state to redis")
        return None

    metrics.incr("sentry.scm.github.rate_limit.state_refreshed")
    return state


def _get_windowed_counter_value(counter_key: str) -> int:
    try:
        current_count = _get_scm_rate_limit_redis().get(counter_key)
    except RedisError:
        logger.exception("Failed to read SCM GitHub rate-limit counter from redis")
        return 0

    if current_count is None:
        return 0
    return int(current_count)


def _is_windowed_counter_limited(
    counter_key: str, limit: int, window_end: int, now: float | None = None
) -> bool:
    if now is None:
        now = time()

    ttl = max(window_end - int(now), 1) + SCM_GITHUB_RATE_LIMIT_GRACE

    try:
        pipe = _get_scm_rate_limit_redis().pipeline()
        pipe.incr(counter_key)
        pipe.expire(counter_key, ttl)
        result = pipe.execute()[0]
    except (RedisError, IndexError):
        logger.exception("Failed to update SCM GitHub rate-limit counter in redis")
        return False

    return int(result) > limit


def is_rate_limited_with_reserved_quotas(
    organization_id: int,
    referrer: Referrer,
    provider: str,
    reserved_allocations: dict[Referrer, int],
    fallback_total_limit: int = SCM_GITHUB_RATE_LIMIT_FALLBACK_TOTAL,
    now: float | None = None,
) -> bool:
    state = get_effective_github_rate_limit_state(
        organization_id, now=now, fallback_limit=fallback_total_limit
    )
    total_reserved = sum(reserved_allocations.values())
    shared_capacity = max(state["limit"] - total_reserved, 0)
    shared_counter_key = _get_github_rate_limit_counter_key(
        organization_id, state["window_end"], provider, "shared"
    )

    if referrer in reserved_allocations:
        dedicated_limit = reserved_allocations[referrer]
        dedicated_counter_key = _get_github_rate_limit_counter_key(
            organization_id, state["window_end"], provider, f"reserved:{referrer}"
        )

        if _get_windowed_counter_value(dedicated_counter_key) < dedicated_limit:
            if not _is_windowed_counter_limited(
                dedicated_counter_key, dedicated_limit, state["window_end"], now=now
            ):
                metrics.incr(
                    "sentry.scm.github.rate_limit.allowed",
                    tags={"referrer": referrer, "pool": "reserved"},
                )
                return False

        metrics.incr("sentry.scm.github.rate_limit.reserved_exhausted", tags={"referrer": referrer})

    if shared_capacity <= 0:
        metrics.incr(
            "sentry.scm.github.rate_limit.rejected", tags={"referrer": referrer, "pool": "shared"}
        )
        return True

    if _is_windowed_counter_limited(
        shared_counter_key, shared_capacity, state["window_end"], now=now
    ):
        metrics.incr(
            "sentry.scm.github.rate_limit.rejected", tags={"referrer": referrer, "pool": "shared"}
        )
        return True

    metrics.incr(
        "sentry.scm.github.rate_limit.allowed", tags={"referrer": referrer, "pool": "shared"}
    )
    return False


def is_rate_limited_with_allocation_policy(
    organization_id: int,
    referrer: Referrer,
    provider: str,
    window: int,
    allocation_policy: dict[Referrer, int],
) -> bool:
    # Check if the referrer has reserved quota they have exclusive access to.
    if referrer != "shared" and referrer in allocation_policy:
        is_allocation_exhausted = is_rate_limited(
            organization_id,
            referrer,
            provider,
            limit=allocation_policy[referrer],
            window=window,
        )
        if not is_allocation_exhausted:
            return False

    # Check if the shared pool has quota.
    return is_rate_limited(
        organization_id,
        "shared",
        provider,
        limit=allocation_policy["shared"],
        window=window,
    )


def map_integration_to_provider(
    organization_id: int,
    integration: Integration | RpcIntegration,
    repository: Repository,
    get_installation: Callable[
        [Integration | RpcIntegration, int], IntegrationInstallation
    ] = lambda i, oid: i.get_installation(organization_id=oid),
) -> Provider:
    client = get_installation(integration, organization_id).get_client()

    if integration.provider == "github":
        return GitHubProvider(client, organization_id, repository)
    elif integration.provider == "gitlab":
        return GitLabProvider(client, organization_id, repository)
    else:
        raise SCMCodedError(integration.provider, code="unsupported_integration")


def map_repository_model_to_repository(repository: RepositoryModel) -> Repository:
    return {
        "integration_id": repository.integration_id,
        "name": repository.name,
        "organization_id": repository.organization_id,
        "is_active": repository.status == ObjectStatus.ACTIVE,
        "external_id": repository.external_id,
    }


def fetch_service_provider(
    organization_id: int,
    repository: Repository,
    map_to_provider: Callable[[Integration | RpcIntegration, int, Repository], Provider] = lambda i,
    oid,
    r: map_integration_to_provider(oid, i, r),
) -> Provider | None:
    integration = integration_service.get_integration(
        integration_id=repository["integration_id"],
        organization_id=organization_id,
    )
    return map_to_provider(integration, organization_id, repository) if integration else None


def fetch_repository(
    organization_id: int, repository_id: int | tuple[ProviderName, ExternalId]
) -> Repository | None:
    try:
        if isinstance(repository_id, int):
            repo = RepositoryModel.objects.get(organization_id=organization_id, id=repository_id)
        else:
            repo = RepositoryModel.objects.get(
                organization_id=organization_id,
                provider=f"integrations:{repository_id[0]}",
                external_id=repository_id[1],
            )
    except RepositoryModel.DoesNotExist:
        return None

    return map_repository_model_to_repository(repo)


def initialize_provider(
    organization_id: int,
    repository_id: RepositoryId,
    *,
    fetch_repository: Callable[[int, RepositoryId], Repository | None] = fetch_repository,
    fetch_service_provider: Callable[[int, Repository], Provider | None] = fetch_service_provider,
) -> Provider:
    repository = fetch_repository(organization_id, repository_id)
    if not repository:
        raise SCMCodedError(organization_id, repository_id, code="repository_not_found")
    if not repository["is_active"]:
        raise SCMCodedError(repository, code="repository_inactive")
    if repository["organization_id"] != organization_id:
        raise SCMCodedError(repository, code="repository_organization_mismatch")

    provider = fetch_service_provider(organization_id, repository)
    if provider is None:
        raise SCMCodedError(code="integration_not_found")

    return provider


def exec_provider_fn[P: Provider, T](
    provider: P,
    *,
    referrer: Referrer = "shared",
    provider_fn: Callable[[], T],
    record_count: Callable[[str, int, dict[str, str]], None] = record_count_metric,
) -> T:
    if provider.is_rate_limited(referrer):
        raise SCMCodedError(provider, referrer, code="rate_limit_exceeded")

    try:
        result = provider_fn()
        record_count(
            "sentry.scm.actions.success_by_provider", 1, {"provider": provider.__class__.__name__}
        )
        record_count("sentry.scm.actions.success_by_referrer", 1, {"referrer": referrer})
        return result
    except SCMError:
        raise
    except Exception as e:
        record_count("sentry.scm.actions.failed", 1, {})
        raise SCMUnhandledException from e
