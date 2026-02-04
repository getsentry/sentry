from __future__ import annotations

import enum
import logging
from collections.abc import Mapping
from enum import Enum, StrEnum
from typing import Any

import orjson
from django.conf import settings
from urllib3.exceptions import HTTPError

from sentry.integrations.github.client import GitHubReaction
from sentry.integrations.github.utils import is_github_rate_limit_sensitive
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.net.http import connection_from_url
from sentry.seer.code_review.models import SeerCodeReviewRequestType, SeerCodeReviewTrigger
from sentry.seer.signed_seer_api import make_signed_seer_api_request

from .metrics import CodeReviewErrorType, record_webhook_handler_error

logger = logging.getLogger(__name__)


class Log(enum.StrEnum):
    MISSING_INTEGRATION = "github.webhook.missing-integration"
    REACTION_FAILED = "github.webhook.reaction-failed"


class ClientError(Exception):
    "Non-retryable client error from Seer"

    pass


def convert_enum_keys_to_strings(obj: Any) -> Any:
    """
    Recursively convert enum keys in dictionaries to their string values.

    This is needed because Pydantic v1 converts string keys to enum members when parsing,
    but JSON serialization requires string keys. Enum values are also converted to strings.

    Args:
        obj: The object to process (can be dict, list, enum, or primitive)

    Returns:
        A copy of the object with all enum keys and values converted to strings
    """
    if isinstance(obj, dict):
        return {
            (k.value if isinstance(k, Enum) else k): convert_enum_keys_to_strings(v)
            for k, v in obj.items()
        }
    elif isinstance(obj, list):
        return [convert_enum_keys_to_strings(item) for item in obj]
    elif isinstance(obj, Enum):
        return obj.value
    else:
        return obj


# These values need to match the value defined in the Seer API.
class SeerEndpoint(StrEnum):
    # https://github.com/getsentry/seer/blob/main/src/seer/routes/automation_request.py#L57
    OVERWATCH_REQUEST = "/v1/automation/overwatch-request"
    # https://github.com/getsentry/seer/blob/main/src/seer/routes/codegen.py
    PR_REVIEW_RERUN = "/v1/automation/codegen/pr-review/rerun"


def get_seer_endpoint_for_event(github_event: str) -> SeerEndpoint:
    """
    Get the appropriate Seer endpoint for a given GitHub webhook event.

    Args:
        github_event: The GitHub webhook event type (as string, after Celery deserialization)

    Returns:
        The SeerEndpoint to use for the event
    """
    if github_event == GithubWebhookType.CHECK_RUN.value:
        return SeerEndpoint.PR_REVIEW_RERUN
    return SeerEndpoint.OVERWATCH_REQUEST


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
    # Prioritize sender (person who triggered the action) over PR author
    # This ensures correct attribution when someone other than the PR author
    # triggers an event (e.g., collaborator pushes commits, admin closes PR
    # or makes ready for review)
    sender = event_payload.get("sender", {})
    pr_author = event_payload.get("pull_request", {}).get("user", {})

    return {
        "trigger_user": sender.get("login") or pr_author.get("login"),
        "trigger_user_id": sender.get("id") or pr_author.get("id"),
        "trigger_comment_id": None,
        "trigger_comment_type": None,
    }


def _get_trigger_metadata_for_issue_comment(event_payload: Mapping[str, Any]) -> dict[str, Any]:
    """Extract trigger metadata for issue_comment events."""
    comment = event_payload.get("comment", {})
    comment_user = comment.get("user", {})

    return {
        "trigger_user": comment_user.get("login"),
        "trigger_user_id": comment_user.get("id"),
        "trigger_comment_id": comment.get("id"),
        "trigger_comment_type": "issue_comment",
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

        client = integration.get_installation(organization_id=repo.organization_id).get_client()
        sha = client.get_pull_request(repo.name, pr_number).get("head", {}).get("sha")
        if not isinstance(sha, str) or not sha:
            raise ValueError("missing-api-pr-head-sha")
        return sha

    raise ValueError("unsupported-event-for-sha")


# XXX: Refactor this function to handle it at the handler level rather than during task execution
def transform_webhook_to_codegen_request(
    github_event: GithubWebhookType,
    github_event_action: str,
    event_payload: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    target_commit_sha: str,
) -> dict[str, Any] | None:
    """
    Transform a GitHub webhook payload into SeerCodeReviewRequest format for Seer.

    Args:
        github_event: The GitHub webhook event type
        github_event_action: The action of the GitHub webhook event
        event_payload: The full webhook event payload from GitHub
        organization: The Sentry organization
        repo: The repository model
        target_commit_sha: The target commit SHA for PR review (head of the PR at the time of webhook event)

    Returns:
        Dictionary in SeerCodeReviewRequest format with request_type, data, and external_owner_id,
        or None if the event is not PR-related (e.g., issue_comment on regular issues)
    """
    payload = None
    if github_event == GithubWebhookType.ISSUE_COMMENT:
        payload = transform_issue_comment_to_codegen_request(
            event_payload, organization, repo, target_commit_sha
        )
    elif github_event == GithubWebhookType.PULL_REQUEST:
        payload = transform_pull_request_to_codegen_request(
            github_event_action, event_payload, organization, repo, target_commit_sha
        )
    return payload


def _common_codegen_request_payload(
    request_type: SeerCodeReviewRequestType,
    repo: Repository,
    target_commit_sha: str,
    organization: Organization,
) -> dict[str, Any]:
    return {
        # In Seer,src/seer/routes/automation_request.py:overwatch_request_endpoint
        "request_type": request_type.value,
        "external_owner_id": repo.external_id,
        "data": {
            "repo": _build_repo_definition(repo, target_commit_sha),
            "bug_prediction_specific_information": {
                "organization_id": organization.id,
                "organization_slug": organization.slug,
            },
            "config": {
                "features": {"bug_prediction": True},
                "github_rate_limit_sensitive": is_github_rate_limit_sensitive(organization),
            },
        },
    }


def transform_issue_comment_to_codegen_request(
    event_payload: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    target_commit_sha: str,
) -> dict[str, Any] | None:
    """
    Transform an issue comment on a PR into a CodecovTaskRequest for Seer.
    """
    payload = _common_codegen_request_payload(
        SeerCodeReviewRequestType.PR_REVIEW,  # An issue comment on a PR is a PR review request
        repo=repo,
        target_commit_sha=target_commit_sha,
        organization=organization,
    )
    payload["data"]["pr_id"] = event_payload["issue"]["number"]
    config = payload["data"]["config"]
    config["trigger"] = SeerCodeReviewTrigger.ON_COMMAND_PHRASE.value
    trigger_metadata = _get_trigger_metadata_for_issue_comment(event_payload)
    config["trigger_user"] = trigger_metadata["trigger_user"]
    config["trigger_user_id"] = trigger_metadata["trigger_user_id"]
    config["trigger_comment_id"] = trigger_metadata["trigger_comment_id"]
    config["trigger_comment_type"] = trigger_metadata["trigger_comment_type"]
    return payload


def transform_pull_request_to_codegen_request(
    github_event_action: str,
    event_payload: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    target_commit_sha: str,
) -> dict[str, Any] | None:
    review_request_trigger = SeerCodeReviewTrigger.UNKNOWN
    match github_event_action:
        case "opened" | "ready_for_review":
            review_request_trigger = SeerCodeReviewTrigger.ON_READY_FOR_REVIEW
        case "synchronize":
            review_request_trigger = SeerCodeReviewTrigger.ON_NEW_COMMIT

    request_type = (
        SeerCodeReviewRequestType.PR_REVIEW
        if github_event_action != "closed"
        else SeerCodeReviewRequestType.PR_CLOSED
    )
    payload = _common_codegen_request_payload(
        request_type,
        repo=repo,
        target_commit_sha=target_commit_sha,
        organization=organization,
    )
    pull_request = event_payload.get("pull_request", {})
    payload["data"]["pr_id"] = pull_request.get("number")
    config = payload["data"]["config"]
    trigger_metadata = _get_trigger_metadata_for_pull_request(event_payload)
    # In Seer, used here:
    # src/seer/automation/codegen/tasks.py
    # src/seer/automation/codegen/pr_review_step.py
    config["trigger"] = review_request_trigger.value
    config["trigger_user"] = trigger_metadata["trigger_user"]
    config["trigger_user_id"] = trigger_metadata["trigger_user_id"]
    config["trigger_comment_id"] = trigger_metadata["trigger_comment_id"]
    config["trigger_comment_type"] = trigger_metadata["trigger_comment_type"]
    return payload


def _build_repo_definition(repo: Repository, target_commit_sha: str) -> dict[str, Any]:
    """
    Build the repository definition for the CodecovTaskRequest.
    """
    # Extract owner and repo name from full repository name (format: "owner/repo")
    repo_name_sections = repo.name.split("/")
    if len(repo_name_sections) < 2:
        raise ValueError(f"Invalid repository name format: {repo.name}")

    repo_definition = {
        "provider": "github",  # All GitHub webhooks use "github" provider
        "owner": repo_name_sections[0],
        "name": "/".join(repo_name_sections[1:]),
        "external_id": repo.external_id,
        "base_commit_sha": target_commit_sha,
        "organization_id": repo.organization_id,
    }

    # add integration_id which is used in pr_closed_step for product metrics dashboarding only
    if repo.integration_id is not None:
        repo_definition["integration_id"] = str(repo.integration_id)

    return repo_definition


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


def extract_github_info(
    event: Mapping[str, Any], github_event: str | None = None
) -> dict[str, str | None]:
    """
    Extract GitHub-related information from a webhook event payload.

    Args:
        event: The GitHub webhook event payload
        github_event: The GitHub event type (e.g., "pull_request", "check_run", "issue_comment")

    Returns:
        Dictionary containing:
            - github_owner: The repository owner/organization name
            - github_repo_name: The repository name
            - github_repo_full_name: The repository full name (owner/repo)
            - github_event_url: URL to the specific event (check_run, pull_request, or comment)
            - github_event: The GitHub event type
            - github_event_action: The event action (e.g., "opened", "closed", "created")
            - github_actor_login: The GitHub username who triggered the action
            - github_actor_id: The GitHub user ID (as string)
    """
    result: dict[str, str | None] = {
        "github_owner": None,
        "github_repo_name": None,
        "github_repo_full_name": None,
        "github_event_url": None,
        "github_event": github_event,
        "github_event_action": None,
        "github_actor_login": None,
        "github_actor_id": None,
    }

    repository = event.get("repository", {})
    if repository:
        if owner := repository.get("owner", {}).get("login"):
            result["github_owner"] = owner
        if repo_name := repository.get("name"):
            result["github_repo_name"] = repo_name
        if owner_repo_name := repository.get("full_name"):
            result["github_repo_full_name"] = owner_repo_name

    if action := event.get("action"):
        result["github_event_action"] = action

    if pull_request := event.get("pull_request"):
        if html_url := pull_request.get("html_url"):
            result["github_event_url"] = html_url

    if check_run := event.get("check_run"):
        if html_url := check_run.get("html_url"):
            result["github_event_url"] = html_url

    if comment := event.get("comment"):
        if html_url := comment.get("html_url"):
            result["github_event_url"] = html_url

    if issue := event.get("issue"):
        if pull_request_data := issue.get("pull_request"):
            if html_url := pull_request_data.get("html_url"):
                if result["github_event_url"] is None:
                    result["github_event_url"] = html_url

    if sender := event.get("sender"):
        if actor_login := sender.get("login"):
            result["github_actor_login"] = actor_login
        if actor_id := sender.get("id"):
            result["github_actor_id"] = str(actor_id)

    return result


def delete_existing_reactions_and_add_reaction(
    github_event: GithubWebhookType,
    github_event_action: str,
    integration: RpcIntegration | None,
    organization_id: int,
    repo: Repository,
    pr_number: str | None,
    comment_id: str | None,
    reactions_to_delete: list[GitHubReaction],
    reaction_to_add: GitHubReaction | None,
    extra: Mapping[str, str | None],
) -> None:
    """
    Delete existing reactions on the PR description and add reaction on the originating issue comment or PR description.
    """
    if integration is None:
        record_webhook_handler_error(
            github_event,
            github_event_action,
            CodeReviewErrorType.MISSING_INTEGRATION,
        )
        logger.warning(Log.MISSING_INTEGRATION.value, extra=extra)
        return

    try:
        client = integration.get_installation(organization_id=organization_id).get_client()

        if pr_number and reactions_to_delete:
            # Delete existing reactions on the PR description
            try:
                existing_reactions = client.get_issue_reactions(repo.name, pr_number)
                for reaction in existing_reactions:
                    if (
                        reaction.get("user", {}).get("login") == "sentry[bot]"
                        and reaction.get("id")
                        and reaction.get("content") in reactions_to_delete
                    ):
                        client.delete_issue_reaction(repo.name, pr_number, str(reaction.get("id")))
            except Exception:
                # Continue even if this fails
                record_webhook_handler_error(
                    github_event,
                    github_event_action,
                    CodeReviewErrorType.REACTION_FAILED,
                )
                logger.warning(Log.REACTION_FAILED.value, extra=extra, exc_info=True)

        if reaction_to_add:
            # Add reaction on the originating issue comment or pr description
            if github_event == GithubWebhookType.PULL_REQUEST:
                client.create_issue_reaction(repo.name, pr_number, reaction_to_add)
            elif github_event == GithubWebhookType.ISSUE_COMMENT:
                client.create_comment_reaction(repo.name, comment_id, reaction_to_add)
    except Exception:
        record_webhook_handler_error(
            github_event,
            github_event_action,
            CodeReviewErrorType.REACTION_FAILED,
        )
        logger.warning(Log.REACTION_FAILED.value, extra=extra, exc_info=True)
