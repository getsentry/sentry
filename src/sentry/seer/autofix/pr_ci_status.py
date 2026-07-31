from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Sequence
from typing import Literal

from sentry.integrations.services.integration import integration_service
from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.models.repository import Repository
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)

PullRequestCiStatus = Literal["passed", "running", "failed"]

# Providers whose integration client exposes the GraphQL statusCheckRollup query.
SUPPORTED_PROVIDERS = ("integrations:github", "integrations:github_enterprise")

# GitHub statusCheckRollup StatusState -> our tri-state; a null rollup (no checks) maps to None.
ROLLUP_STATE_MAP: dict[str, PullRequestCiStatus] = {
    "SUCCESS": "passed",
    "PENDING": "running",
    "EXPECTED": "running",
    "FAILURE": "failed",
    "ERROR": "failed",
}

# States for which CI status is meaningless (the PR is no longer running checks).
_SKIP_STATES = (PullRequestLifecycleState.MERGED, PullRequestLifecycleState.CLOSED)

PR_CI_CACHE_TIMEOUT_SECONDS = 2 * 60  # 2 minutes
PR_CI_NEGATIVE_CACHE_TIMEOUT_SECONDS = 30  # 30 seconds
# Distinguishes a cached indeterminate result from a cache miss; never returned.
_UNKNOWN = "unknown"


def _get_pr_ci_cache_key(pull_request: PullRequest) -> str:
    # The stored head sha invalidates the key on push; NULL-sha shell rows fall back to TTL expiry.
    return f"seer:pr_ci:{pull_request.id}:{pull_request.head_commit_sha or ''}"


def _cache_status(pull_request: PullRequest, status: PullRequestCiStatus | None) -> None:
    if status is None:
        cache.set(
            _get_pr_ci_cache_key(pull_request),
            _UNKNOWN,
            timeout=PR_CI_NEGATIVE_CACHE_TIMEOUT_SECONDS,
        )
    else:
        cache.set(_get_pr_ci_cache_key(pull_request), status, timeout=PR_CI_CACHE_TIMEOUT_SECONDS)


def get_pr_ci_status(pull_request: PullRequest) -> PullRequestCiStatus | None:
    """Resolve the CI status of a single PR's head commit; thin wrapper over the batch API."""
    return get_pr_ci_statuses([pull_request]).get(pull_request.id)


def get_pr_ci_statuses(
    pull_requests: Sequence[PullRequest],
) -> dict[int, PullRequestCiStatus | None]:
    """Resolve CI status for many PRs with one GraphQL query per integration, cached; never raises."""
    result: dict[int, PullRequestCiStatus | None] = {}
    misses: list[PullRequest] = []
    for pull_request in pull_requests:
        if pull_request.state in _SKIP_STATES:
            result[pull_request.id] = None
            continue
        cached = cache.get(_get_pr_ci_cache_key(pull_request))
        if cached is not None:
            result[pull_request.id] = None if cached == _UNKNOWN else cached
        else:
            misses.append(pull_request)

    if not misses:
        return result

    repos_by_id = {
        repo.id: repo
        for repo in Repository.objects.filter(id__in={pr.repository_id for pr in misses})
    }

    # Group by (integration, org) so each group resolves one client and one GraphQL round trip.
    groups: dict[tuple[int, int], list[PullRequest]] = defaultdict(list)
    for pull_request in misses:
        repo = repos_by_id.get(pull_request.repository_id)
        if repo is None or repo.provider not in SUPPORTED_PROVIDERS or repo.integration_id is None:
            result[pull_request.id] = None
            _cache_status(pull_request, None)
            continue
        groups[(repo.integration_id, pull_request.organization_id)].append(pull_request)

    for (integration_id, organization_id), group in groups.items():
        result.update(
            _resolve_group(integration_id, organization_id, group, repos_by_id),
        )
    return result


def _resolve_group(
    integration_id: int,
    organization_id: int,
    pull_requests: list[PullRequest],
    repos_by_id: dict[int, Repository],
) -> dict[int, PullRequestCiStatus | None]:
    resolved: dict[int, PullRequestCiStatus | None] = {}
    specs: list[tuple[str, str, int]] = []
    queried: list[PullRequest] = []
    for pull_request in pull_requests:
        try:
            owner, name = repos_by_id[pull_request.repository_id].name.split("/", maxsplit=1)
            number = int(pull_request.key)
        except (ValueError, TypeError):
            resolved[pull_request.id] = None
            _cache_status(pull_request, None)
            continue
        specs.append((owner, name, number))
        queried.append(pull_request)

    if not specs:
        return resolved

    try:
        integration = integration_service.get_integration(integration_id=integration_id)
        if integration is None:
            raise ValueError("integration not found")
        client = integration.get_installation(organization_id=organization_id).get_client()
        states = client.get_pr_ci_statuses(specs)
    except Exception:
        logger.exception(
            "seer.pr_ci_status.batch_failed",
            extra={"integration_id": integration_id, "organization_id": organization_id},
        )
        for pull_request in queried:
            resolved[pull_request.id] = None
            _cache_status(pull_request, None)
        return resolved

    for pull_request, state in zip(queried, states):
        status = ROLLUP_STATE_MAP.get(state) if state is not None else None
        resolved[pull_request.id] = status
        _cache_status(pull_request, status)
    return resolved
