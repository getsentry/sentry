from collections.abc import Mapping
from enum import StrEnum
from typing import Any, Literal

import orjson
from django.conf import settings
from urllib3.exceptions import HTTPError

from sentry import options
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.repository import Repository
from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request


class ClientError(Exception):
    "Non-retryable client error from Seer"

    pass


class SeerEndpoint(StrEnum):
    # XXX: We will need to either add a new one or re-use the overwatch-request endpoint.
    # https://github.com/getsentry/seer/blob/main/src/seer/routes/automation_request.py#L57
    SENTRY_REQUEST = "/v1/automation/sentry-request"
    # This needs to match the value defined in the Seer API:
    # https://github.com/getsentry/seer/blob/main/src/seer/routes/codegen.py
    PR_REVIEW_RERUN = "/v1/automation/codegen/pr-review/rerun"


def call_seer_if_allowed(
    *, event_type: GithubWebhookType, event_payload: Mapping[str, Any], **kwargs: Any
) -> None:
    """
    Call Seer if the option is enabled.
    """
    from .webhooks.config import EVENT_TYPE_TO_OPTION

    assert event_payload is not None
    option_key = EVENT_TYPE_TO_OPTION.get(event_type)
    if option_key and not options.get(option_key):
        return

    make_seer_request(path=SeerEndpoint.SENTRY_REQUEST.value, payload=event_payload)


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


# XXX: Do a thorough review of this function and make sure it's correct.
def _transform_webhook_to_codegen_request(
    event_type: GithubWebhookType,
    event_payload: Mapping[str, Any],
    organization_id: int,
    repo: Repository,
) -> dict[str, Any] | None:
    """
    Transform a GitHub webhook payload into CodecovTaskRequest format for Seer.

    Args:
        event_type: The type of GitHub webhook event
        event_payload: The full webhook event payload from GitHub
        organization_id: The Sentry organization ID

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
    }

    # Build CodegenBaseRequest (minimal required fields)
    codegen_request = {
        "repo": repo_definition,
        "pr_id": pr_number,
        "codecov_status": None,
        "more_readable_repos": [],
    }

    # Build CodecovTaskRequest
    return {
        "data": codegen_request,
        "external_owner_id": repo.external_id,
        "request_type": request_type,
        "organization_id": organization_id,
    }
