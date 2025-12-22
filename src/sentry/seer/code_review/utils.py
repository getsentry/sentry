from collections.abc import Mapping
from typing import Any, Literal

import orjson
from django.conf import settings
from urllib3.exceptions import HTTPError

from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request


class ClientError(Exception):
    "Non-retryable client error from Seer"

    pass


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


def _transform_webhook_to_codegen_request(
    event_type: str, event_payload: dict[str, Any]
) -> dict[str, Any]:
    """
    Transform a GitHub webhook payload into CodecovTaskRequest format for Seer.

    Args:
        event_type: The type of GitHub webhook event
        event_payload: The full webhook event payload from GitHub

    Returns:
        Dictionary in CodecovTaskRequest format with request_type, data, and external_owner_id

    Raises:
        ValueError: If required fields are missing from the webhook payload
    """
    # Extract repository information
    repository = event_payload.get("repository")
    if not repository:
        raise ValueError("Missing repository in webhook payload")

    # Determine request_type based on event_type
    # For now, we only support pr-review for these webhook types
    request_type: Literal["pr-review", "unit-tests", "pr-closed"] = "pr-review"

    # Extract pull request number
    # Different event types have PR info in different locations
    pr_number = None
    if "pull_request" in event_payload:
        pr_number = event_payload["pull_request"]["number"]
    elif "issue" in event_payload and "pull_request" in event_payload["issue"]:
        # issue_comment events on PRs have the PR number in the issue
        pr_number = event_payload["issue"]["number"]

    if not pr_number:
        raise ValueError(f"Cannot extract PR number from {event_type} webhook payload")

    # Build RepoDefinition
    repo_definition = {
        "provider": "github",  # All GitHub webhooks use "github" provider
        "owner": repository["owner"]["login"],
        "name": repository["name"],
        "external_id": str(repository["id"]),
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
        "external_owner_id": repository["owner"]["login"],
        "request_type": request_type,
    }
