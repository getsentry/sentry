from __future__ import annotations

from collections.abc import Mapping
from enum import StrEnum
from typing import Any

import orjson
from django.conf import settings
from urllib3.exceptions import HTTPError

from sentry import options
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request


# XXX: This needs to be a shared enum with the Seer repository
# Look at CodecovTaskRequest.request_type in Seer repository for the possible request types
class RequestType(StrEnum):
    # It triggers PR review events on Seer side
    PR_REVIEW = "pr-review"
    # It triggers PR closed events on Seer side
    PR_CLOSED = "pr-closed"


# XXX: This needs to be a shared enum with the Seer repository
# In Seer, src/seer/automation/codegen/types.py:PrReviewTrigger
class PrReviewTrigger(StrEnum):
    UNKNOWN = "unknown"
    ON_COMMAND_PHRASE = "on_command_phrase"
    ON_READY_FOR_REVIEW = "on_ready_for_review"
    ON_NEW_COMMIT = "on_new_commit"

    @classmethod
    def _missing_(cls: type[PrReviewTrigger], value: object) -> PrReviewTrigger:
        return cls.UNKNOWN


class ClientError(Exception):
    "Non-retryable client error from Seer"

    pass


# These values need to match the value defined in the Seer API.
class SeerEndpoint(StrEnum):
    # https://github.com/getsentry/seer/blob/main/src/seer/routes/automation_request.py#L57
    OVERWATCH_REQUEST = "/v1/automation/overwatch-request"
    # https://github.com/getsentry/seer/blob/main/src/seer/routes/codegen.py
    PR_REVIEW_RERUN = "/v1/automation/codegen/pr-review/rerun"


def get_seer_endpoint_for_event(github_event: GithubWebhookType) -> SeerEndpoint:
    """
    Get the appropriate Seer endpoint for a given GitHub webhook event.

    Args:
        github_event: The GitHub webhook event type

    Returns:
        The SeerEndpoint to use for the event
    """
    if github_event == GithubWebhookType.CHECK_RUN:
        return SeerEndpoint.PR_REVIEW_RERUN
    return SeerEndpoint.OVERWATCH_REQUEST


def _get_webhook_option_key(webhook_type: GithubWebhookType) -> str | None:
    """
    Get the option key for a given GitHub webhook type.

    Args:
        webhook_type: The GitHub webhook event type

    Returns:
        The option key string if the webhook type has an associated option, None otherwise
    """
    from .webhooks.config import WEBHOOK_TYPE_TO_OPTION_KEY

    return WEBHOOK_TYPE_TO_OPTION_KEY.get(webhook_type)


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
        connection_pool=connection_from_url(settings.SEER_PREVENT_AI_URL),
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


def _get_trigger_metadata_for_pull_request(event_payload: Mapping[str, Any]) -> dict[str, Any]:
    """Extract trigger metadata for pull_request events."""
    trigger_user = event_payload.get("sender", {}).get("login") or event_payload.get(
        "pull_request", {}
    ).get("user", {}).get("login")

    return {
        "trigger_user": trigger_user,
        "trigger_comment_id": None,
        "trigger_comment_type": None,
    }


def _get_trigger_metadata_for_issue_comment(event_payload: Mapping[str, Any]) -> dict[str, Any]:
    """Extract trigger metadata for issue_comment events."""
    comment = event_payload.get("comment", {})
    trigger_user = comment.get("user", {}).get("login")
    trigger_comment_id = comment.get("id")
    trigger_comment_type = "issue_comment"

    return {
        "trigger_user": trigger_user,
        "trigger_comment_id": trigger_comment_id,
        "trigger_comment_type": trigger_comment_type,
    }


def _get_trigger_metadata(
    github_event: GithubWebhookType, event_payload: Mapping[str, Any]
) -> dict[str, Any]:
    """Extract trigger metadata fields from the event payload based on the GitHub event type."""
    if github_event == GithubWebhookType.PULL_REQUEST:
        return _get_trigger_metadata_for_pull_request(event_payload)

    if github_event == GithubWebhookType.ISSUE_COMMENT:
        return _get_trigger_metadata_for_issue_comment(event_payload)

    raise ValueError(f"unsupported-event-type-for-trigger-metadata: {github_event}")


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

        client = integration.get_installation(organization_id=repo.organization_id).get_client()
        sha = client.get_pull_request(repo.name, pr_number).get("head", {}).get("sha")
        if not isinstance(sha, str) or not sha:
            raise ValueError("missing-api-pr-head-sha")
        return sha

    raise ValueError("unsupported-event-for-sha")


# XXX: Refactor this function to handle it at the handler level rather than during task execution
def transform_webhook_to_codegen_request(
    github_event: GithubWebhookType,
    github_event_action: str,  # XXX: This should be the enum
    event_payload: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    target_commit_sha: str,
) -> dict[str, Any] | None:
    """
    Transform a GitHub webhook payload into CodecovTaskRequest format for Seer.

    Args:
        github_event: The GitHub webhook event type
        github_event_action: The action of the GitHub webhook event
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
    request_type = RequestType.PR_REVIEW
    if github_event == GithubWebhookType.PULL_REQUEST and github_event_action == "closed":
        request_type = RequestType.PR_CLOSED

    review_request_trigger = PrReviewTrigger.UNKNOWN
    match github_event_action:
        case "opened" | "ready_for_review":
            review_request_trigger = PrReviewTrigger.ON_READY_FOR_REVIEW
        case "synchronize":
            review_request_trigger = PrReviewTrigger.ON_NEW_COMMIT

    # We know that we only schedule a task if the comment contains the command phrase
    if github_event == GithubWebhookType.ISSUE_COMMENT:
        review_request_trigger = PrReviewTrigger.ON_COMMAND_PHRASE

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

    trigger_metadata = _get_trigger_metadata(github_event, event_payload)

    # XXX: We will need to share classes between Sentry and Seer to avoid code duplication
    # for the request payload.
    # For now, we will use the same class names and fields as the Seer repository.
    # Build CodecovTaskRequest
    return {
        # In Seer,src/seer/routes/automation_request.py:overwatch_request_endpoint
        "request_type": request_type.value,
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
                # In Seer, used here:
                # src/seer/automation/codegen/tasks.py
                # src/seer/automation/codegen/pr_review_step.py
                "trigger": review_request_trigger.value,
                **trigger_metadata,
            },
        },
    }


def get_pr_author_id(event: Mapping[str, Any]) -> str | None:
    """
    Extract the PR author's GitHub user ID from the webhook payload.
    The user information can be found in different locations depending on the webhook type.
    """
    # Check issue.user.id (for issue comments on PRs)
    if (user_id := event.get("issue", {}).get("user", {}).get("id")) is not None:
        return str(user_id)

    # Check pull_request.user.id (for pull request events)
    if (user_id := event.get("pull_request", {}).get("user", {}).get("id")) is not None:
        return str(user_id)

    # Check user.id (fallback for direct user events)
    if (user_id := event.get("user", {}).get("id")) is not None:
        return str(user_id)

    # Check sender.id (for check_run events). Sender is the user who triggered the event
    if (user_id := event.get("sender", {}).get("id")) is not None:
        return str(user_id)

    return None


def should_forward_to_seer(
    github_event: GithubWebhookType, event_payload: Mapping[str, Any]
) -> bool:
    """
    Determine if we should proceed with the code review flow to Seer.

    We will proceed if the GitHub org is in the direct-to-seer whitelist.
    For CHECK_RUN events (no option key), we always proceed.
    """
    if not should_forward_to_overwatch(github_event):
        return True

    return is_github_org_direct_to_seer(event_payload)


def is_github_org_direct_to_seer(event_payload: Mapping[str, Any]) -> bool:
    """
    Determine if the GitHub org is in the direct-to-seer whitelist.
    """
    repository = event_payload.get("repository", {})
    if not isinstance(repository, dict):
        return False
    owner = repository.get("owner", {})
    if not isinstance(owner, dict):
        return False
    github_org = owner.get("login")
    return github_org is not None and github_org in _direct_to_seer_gh_orgs()


def should_forward_to_overwatch(github_event: GithubWebhookType) -> bool:
    """
    Determine if a GitHub webhook event should be forwarded to Overwatch.

    - If there is no option key (i.e., _get_webhook_option_key returns None),
      the event should NOT be forwarded to Overwatch (returns False).
      This ensures events like CHECK_RUN are excluded from forwarding.
    - If there is an option key, forwarding is controlled by the option value.

    Args:
        github_event: The GitHub webhook event type.

    Returns:
        bool: True if the event should be forwarded to Overwatch, False otherwise.
    """
    option_key = _get_webhook_option_key(github_event)
    if option_key is None:
        return False
    return options.get(option_key)


def _direct_to_seer_gh_orgs() -> list[str]:
    """
    Returns the list of GitHub org names that should always send directly to Seer.
    """
    return options.get("seer.code-review.direct-to-seer-enabled-gh-orgs") or []
