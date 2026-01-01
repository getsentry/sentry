from collections.abc import Mapping
from enum import StrEnum
from typing import Any, Literal

import orjson
from django.conf import settings
from urllib3.exceptions import HTTPError

from sentry.integrations.github.client import GitHubApiClient
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request


class ClientError(Exception):
    "Non-retryable client error from Seer"

    pass


# These values need to match the value defined in the Seer API.
class SeerEndpoint(StrEnum):
    # https://github.com/getsentry/seer/blob/main/src/seer/routes/automation_request.py#L57
    OVERWATCH_REQUEST = "/v1/automation/overwatch-request"
    # https://github.com/getsentry/seer/blob/main/src/seer/routes/codegen.py
    PR_REVIEW_RERUN = "/v1/automation/codegen/pr-review/rerun"


def make_seer_request(path: str, payload: Mapping[str, Any]) -> bytes:
    """
    Make a request to the Seer API and return the response data.

    Args:
        path: The path to the Seer API
        payload: The payload to send to the Seer API

    Raises:
        HTTPError: If the Seer API returns a retryable status
        ClientError: If the Seer API returns a client error

    Returns:
        The response data from the Seer API
    """
    response = make_signed_seer_api_request(
        connection_pool=connection_from_url(settings.SEER_AUTOFIX_URL),
        path=path,
        body=orjson.dumps(payload),
    )
    # Retry on server errors (5xx) and rate limits (429), but not client errors (4xx)
    if response.status >= 500 or response.status == 429:
        raise HTTPError(f"Seer returned retryable status {response.status}")
    elif response.status >= 400:
        # Client errors are permanent, don't retry
        raise ClientError(f"Seer returned client error {response.status}")
    else:
        return response.data


def _get_trigger_metadata(event_payload: Mapping[str, Any]) -> dict[str, Any]:
    """Extract trigger metadata fields from the event payload."""
    comment = event_payload.get("comment")

    if comment:
        trigger_user = comment.get("user", {}).get("login")
        trigger_comment_id = comment.get("id")
        trigger_comment_type = (
            "pull_request_review_comment"
            if comment.get("pull_request_review_id") is not None
            else "issue_comment"
        )
    else:
        trigger_user = event_payload.get("sender", {}).get("login") or event_payload.get(
            "pull_request", {}
        ).get("user", {}).get("login")
        trigger_comment_id = None
        trigger_comment_type = None

    return {
        "trigger_user": trigger_user,
        "trigger_comment_id": trigger_comment_id,
        "trigger_comment_type": trigger_comment_type,
    }


def _get_target_commit_sha(
    github_event: GithubWebhookType,
    event_payload: Mapping[str, Any],
    repo: Repository,
    integration: RpcIntegration | None,
) -> str:
    """
    Get the target commit SHA for code review.
    """
    if github_event == GithubWebhookType.PULL_REQUEST:
        sha = event_payload.get("pull_request", {}).get("head", {}).get("sha")
        if not isinstance(sha, str) or not sha:
            raise ValueError("missing-pr-head-sha")
        return sha

    if github_event == GithubWebhookType.ISSUE_COMMENT:
        if integration is None:
            raise ValueError("missing-integration-for-sha")
        pr_number = event_payload.get("issue", {}).get("number")
        if not isinstance(pr_number, int):
            raise ValueError("missing-pr-number-for-sha")
        sha = (
            GitHubApiClient(integration=integration)
            .get_pull_request(repo.name, pr_number)
            .get("head", {})
            .get("sha")
        )
        if not isinstance(sha, str) or not sha:
            raise ValueError("missing-api-pr-head-sha")
        return sha

    raise ValueError("unsupported-event-for-sha")


def transform_webhook_to_codegen_request(
    github_event: GithubWebhookType,
    event_payload: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    target_commit_sha: str,
    trigger: CodeReviewTrigger,
) -> dict[str, Any] | None:
    """
    Transform a GitHub webhook payload into CodecovTaskRequest format for Seer.

    Args:
        event_payload: The full webhook event payload from GitHub
        organization: The Sentry organization
        repo: The repository model
        target_commit_sha: The target commit SHA for PR review (head of the PR at the time of webhook event)
        trigger: The trigger type for the PR review

    Returns:
        Dictionary in CodecovTaskRequest format with request_type, data, and external_owner_id,
        or None if the event is not PR-related (e.g., issue_comment on regular issues)

    Raises:
        ValueError: If required fields are missing from the webhook payload
    """
    # Determine request_type based on event_type
    # For now, we only support pr-review for these webhook types
    request_type: Literal["pr-review", "pr-closed"] = "pr-review"

    # Extract pull request number
    # Different event types have PR info in different locations
    pr_number = None
    if "pull_request" in event_payload:
        pr_number = event_payload["pull_request"]["number"]
    elif "issue" in event_payload and "pull_request" in event_payload["issue"]:
        # issue_comment events on PRs have the PR number in the issue
        pr_number = event_payload["issue"]["number"]

    if not pr_number:
        # Not a PR-related event (e.g., issue_comment on regular issues)
        return None

    # Extract owner and repo name from full repository name (format: "owner/repo")
    repo_name_sections = repo.name.split("/")
    if len(repo_name_sections) < 2:
        raise ValueError(f"Invalid repository name format: {repo.name}")

    owner = repo_name_sections[0]
    repo_name = "/".join(repo_name_sections[1:])

    # Build RepoDefinition
    repo_definition = {
        "provider": "github",  # All GitHub webhooks use "github" provider
        "owner": owner,
        "name": repo_name,
        "external_id": repo.external_id,
        "base_commit_sha": target_commit_sha,
    }

    trigger_metadata = _get_trigger_metadata(event_payload)

    # Build CodecovTaskRequest
    return {
        "request_type": request_type,
        "external_owner_id": repo.external_id,
        "data": {
            "repo": repo_definition,
            "pr_id": pr_number,
            "bug_prediction_specific_information": {
                "organization_id": organization.id,
                "organization_slug": organization.slug,
            },
            "config": {
                "features": {
                    "bug_prediction": True,
                },
                "trigger": trigger,
                **trigger_metadata,
            },
        },
    }
