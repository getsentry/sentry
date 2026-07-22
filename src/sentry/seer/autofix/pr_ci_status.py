from __future__ import annotations

import logging
from typing import Literal

from sentry.integrations.github.client import GitHubCheckRunConclusion, GitHubCheckRunStatus
from sentry.integrations.services.integration import integration_service
from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.models.repository import Repository
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)

PullRequestCiStatus = Literal["passed", "running", "failed"]

# Providers whose integration client exposes the GitHub checks API.
SUPPORTED_PROVIDERS = ("integrations:github", "integrations:github_enterprise")

# Mirrors check_suites.FAILURE_CONCLUSIONS plus startup_failure (we read raw conclusions; scm normalizes it to failure).
FAILURE_CONCLUSIONS = (
    GitHubCheckRunConclusion.FAILURE,
    GitHubCheckRunConclusion.TIMED_OUT,
    GitHubCheckRunConclusion.ACTION_REQUIRED,
    GitHubCheckRunConclusion.STARTUP_FAILURE,
)

# States for which CI status is meaningless (the PR is no longer running checks).
_SKIP_STATES = (PullRequestLifecycleState.MERGED, PullRequestLifecycleState.CLOSED)

PR_CI_CACHE_TIMEOUT_SECONDS = 2 * 60  # 2 minutes
PR_CI_NEGATIVE_CACHE_TIMEOUT_SECONDS = 30  # 30 seconds
# Distinguishes a cached indeterminate result from a cache miss; never returned.
_UNKNOWN = "unknown"


def _get_pr_ci_cache_key(pull_request: PullRequest) -> str:
    # The stored head sha invalidates the key on push; NULL-sha shell rows fall back to TTL expiry.
    return f"seer:pr_ci:{pull_request.id}:{pull_request.head_commit_sha or ''}"


def get_pr_ci_status(pull_request: PullRequest) -> PullRequestCiStatus | None:
    """Aggregate CI status of a PR's head commit from GitHub check runs, cached; never raises."""
    if pull_request.state in _SKIP_STATES:
        return None

    cache_key = _get_pr_ci_cache_key(pull_request)
    cached = cache.get(cache_key)
    if cached is not None:
        return None if cached == _UNKNOWN else cached

    try:
        result = _compute_ci_status(pull_request)
    except Exception:
        logger.exception(
            "seer.pr_ci_status.compute_failed",
            extra={"pull_request_id": pull_request.id},
        )
        result = None

    if result is None:
        cache.set(cache_key, _UNKNOWN, timeout=PR_CI_NEGATIVE_CACHE_TIMEOUT_SECONDS)
        return None

    cache.set(cache_key, result, timeout=PR_CI_CACHE_TIMEOUT_SECONDS)
    return result


def _compute_ci_status(pull_request: PullRequest) -> PullRequestCiStatus | None:
    repo = Repository.objects.filter(id=pull_request.repository_id).first()
    if repo is None or repo.provider not in SUPPORTED_PROVIDERS:
        return None

    integration = integration_service.get_integration(integration_id=repo.integration_id)
    if integration is None:
        return None
    client = integration.get_installation(organization_id=pull_request.organization_id).get_client()

    sha = pull_request.head_commit_sha
    if not sha:
        sha = client.get_pull_request(repo.name, pull_request.key).get("head", {}).get("sha")
    if not sha:
        return None

    check_runs = client.get_all_check_runs(repo.name, sha)
    if not check_runs:
        return None
    if any(run.get("conclusion") in FAILURE_CONCLUSIONS for run in check_runs):
        return "failed"
    if any(run.get("status") != GitHubCheckRunStatus.COMPLETED for run in check_runs):
        return "running"
    return "passed"
