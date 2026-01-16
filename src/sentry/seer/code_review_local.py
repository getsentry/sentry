import logging
from typing import Any

from django.conf import settings
from urllib3.exceptions import MaxRetryError, TimeoutError

from sentry.net.http import connection_from_url
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json
from sentry.utils.json import JSONDecodeError

logger = logging.getLogger(__name__)

# Connection pool for CLI bug prediction requests
seer_cli_bug_prediction_connection_pool = connection_from_url(
    settings.SEER_DEFAULT_URL,
    timeout=settings.CODE_REVIEW_LOCAL_TIMEOUT,
)


def trigger_code_review_local(
    repo_provider: str,
    repo_owner: str,
    repo_name: str,
    repo_external_id: str,
    base_commit_sha: str,
    diff: str,
    organization_id: int,
    organization_slug: str,
    user_id: int,
    user_name: str,
    commit_message: str | None = None,
) -> dict[str, Any]:
    """
    Trigger CLI bug prediction analysis in Seer.

    Args:
        repo_provider: Repository provider (e.g., "github", "gitlab")
        repo_owner: Repository owner/organization
        repo_name: Repository name
        repo_external_id: External ID from integration
        base_commit_sha: Base commit SHA (40 chars)
        diff: Git diff content
        organization_id: Sentry organization ID
        organization_slug: Sentry organization slug
        user_id: User ID making the request
        user_name: Username making the request
        commit_message: Optional commit message

    Returns:
        dict with "run_id" and "status" keys

    Raises:
        TimeoutError: If request times out
        MaxRetryError: If max retries exceeded
        ValueError: If response is invalid
    """
    body_dict: dict[str, Any] = {
        "repo": {
            "provider": repo_provider,
            "owner": repo_owner,
            "name": repo_name,
            "external_id": repo_external_id,
            "base_commit_sha": base_commit_sha,
        },
        "diff": diff,
        "organization_id": organization_id,
        "organization_slug": organization_slug,
        "user_id": user_id,
        "user_name": user_name,
    }

    if commit_message:
        body_dict["commit_message"] = commit_message

    logger.info(
        "seer.cli_bug_prediction.trigger",
        extra={
            "organization_id": organization_id,
            "user_id": user_id,
            "repo_provider": repo_provider,
            "repo_external_id": repo_external_id,
            "diff_size": len(diff),
        },
    )

    try:
        response = make_signed_seer_api_request(
            connection_pool=seer_cli_bug_prediction_connection_pool,
            path="/v1/automation/codegen/cli-bug-prediction",
            body=json.dumps(body_dict).encode("utf-8"),
            timeout=10,  # Initial trigger should be fast
        )
    except (TimeoutError, MaxRetryError):
        logger.exception(
            "seer.cli_bug_prediction.trigger.timeout",
            extra={
                "organization_id": organization_id,
                "user_id": user_id,
            },
        )
        raise

    if response.status >= 400:
        # Try to extract error message from Seer's response
        error_detail = ""
        try:
            error_data = json.loads(response.data)
            error_detail = error_data.get("detail", error_data.get("message", str(error_data)))
        except (JSONDecodeError, TypeError):
            error_detail = response.data.decode("utf-8") if response.data else "Unknown error"

        logger.error(
            "seer.cli_bug_prediction.trigger.error",
            extra={
                "organization_id": organization_id,
                "user_id": user_id,
                "status_code": response.status,
                "error_detail": error_detail,
            },
        )
        raise ValueError(f"Seer error ({response.status}): {error_detail}")

    try:
        response_data = json.loads(response.data)
    except JSONDecodeError:
        logger.exception(
            "seer.cli_bug_prediction.trigger.invalid_response",
            extra={
                "organization_id": organization_id,
                "user_id": user_id,
            },
        )
        raise ValueError("Invalid JSON response from Seer")

    if "run_id" not in response_data:
        logger.error(
            "seer.cli_bug_prediction.trigger.missing_run_id",
            extra={
                "organization_id": organization_id,
                "user_id": user_id,
                "response_data": response_data,
            },
        )
        raise ValueError("Missing run_id in Seer response")

    logger.info(
        "seer.cli_bug_prediction.trigger.success",
        extra={
            "organization_id": organization_id,
            "user_id": user_id,
            "run_id": response_data["run_id"],
        },
    )

    return response_data


def get_code_review_local_status(run_id: int) -> dict[str, Any]:
    """
    Get the status of a CLI bug prediction run.

    Args:
        run_id: The Seer run ID from trigger_code_review_local

    Returns:
        dict with "status" key and optionally "predictions" and "diagnostics"

    Raises:
        TimeoutError: If request times out
        MaxRetryError: If max retries exceeded
        ValueError: If response is invalid
    """
    logger.debug("seer.cli_bug_prediction.status.check", extra={"run_id": run_id})

    try:
        # Seer status endpoint uses GET method
        response = seer_cli_bug_prediction_connection_pool.urlopen(
            "GET",
            f"/v1/automation/codegen/cli-bug-prediction/{run_id}",
            headers={"content-type": "application/json;charset=utf-8"},
            timeout=5,
        )
    except (TimeoutError, MaxRetryError):
        logger.exception(
            "seer.cli_bug_prediction.status.timeout",
            extra={"run_id": run_id},
        )
        raise

    if response.status >= 400:
        logger.error(
            "seer.cli_bug_prediction.status.error",
            extra={
                "run_id": run_id,
                "status_code": response.status,
                "response_data": response.data,
            },
        )
        raise ValueError(f"Seer returned error status: {response.status}")

    try:
        response_data = json.loads(response.data)
    except JSONDecodeError:
        logger.exception(
            "seer.cli_bug_prediction.status.invalid_response",
            extra={"run_id": run_id},
        )
        raise ValueError("Invalid JSON response from Seer")

    if "status" not in response_data:
        logger.error(
            "seer.cli_bug_prediction.status.missing_status",
            extra={"run_id": run_id, "response_data": response_data},
        )
        raise ValueError("Missing status in Seer response")

    return response_data
