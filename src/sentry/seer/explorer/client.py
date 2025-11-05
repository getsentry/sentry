"""
Seer Explorer Client - Simple interface for running AI debugging agents.

This module provides a minimal interface for Sentry developers to build agentic features
with full Sentry context, all without directly touching Seer code.

Example usage:
    from sentry.seer.explorer.client import start_seer_run, continue_seer_run, get_seer_run

    # Start a new conversation (client automatically collects user/org context)
    run_id = start_seer_run(
        organization=organization,
        prompt="Analyze trace XYZ and find performance issues",
        user=request.user,
    )

    # Continue the conversation
    continue_seer_run(
        run_id=run_id,
        organization=organization,
        prompt="What about memory leaks?",
    )

    # Get current status (non-blocking)
    state = get_seer_run(run_id=run_id, organization=organization)
    print(state.status, state.blocks)

    # Or wait for completion (blocking with polling)
    state = get_seer_run(run_id=run_id, organization=organization, blocking=True)
"""

from __future__ import annotations

from typing import Any

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AnonymousUser

from sentry.models.organization import Organization
from sentry.seer.explorer.client_models import ExplorerRun, SeerRunState
from sentry.seer.explorer.client_utils import (
    collect_user_org_context,
    fetch_run_status,
    has_seer_explorer_access_with_detail,
    poll_until_done,
)
from sentry.seer.models import SeerPermissionError
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.users.models.user import User


def start_seer_run(
    organization: Organization,
    prompt: str,
    user: User | AnonymousUser | None = None,
    on_page_context: str | None = None,
    category_key: str | None = None,
    category_value: str | None = None,
) -> int:
    """
    Start a new Seer Explorer session.

    The client automatically collects user/org context (teams, projects, etc.)
    and sends it to Seer for the agent to use.

    Args:
        organization: Sentry organization
        prompt: The initial task/query for the agent
        user: User (from request.user, can be User or AnonymousUser or None)
        on_page_context: Optional context from the user's screen
        category_key: Optional category key for filtering/grouping runs (e.g., "bug-fixer", "researcher"). Should identify the purpose/use case of the run.
        category_value: Optional category value for filtering/grouping runs (e.g., "issue-123", "a5b32"). Should identify individual runs within the category.

    Returns:
        int: The run ID that can be used to fetch results or continue the conversation

    Raises:
        SeerPermissionError: If the user/org doesn't have access to Seer Explorer
        requests.HTTPError: If the Seer API request fails
    """
    # Check access
    has_access, error = has_seer_explorer_access_with_detail(organization, user)
    if not has_access:
        raise SeerPermissionError(error or "Access denied")

    path = "/v1/automation/explorer/chat"

    payload: dict[str, Any] = {
        "organization_id": organization.id,
        "query": prompt,
        "run_id": None,
        "insert_index": None,
        "on_page_context": on_page_context,
        "user_org_context": collect_user_org_context(user, organization),
    }

    if category_key or category_value:
        if not category_key or not category_value:
            raise ValueError("category_key and category_value must be provided together")
        payload["category_key"] = category_key
        payload["category_value"] = category_value

    body = orjson.dumps(payload, option=orjson.OPT_NON_STR_KEYS)

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}{path}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )

    response.raise_for_status()
    result = response.json()
    return result["run_id"]


def continue_seer_run(
    run_id: int,
    organization: Organization,
    prompt: str,
    user: User | AnonymousUser | None = None,
    insert_index: int | None = None,
    on_page_context: str | None = None,
) -> int:
    """
    Continue an existing Seer Explorer session.

    This allows you to add follow-up queries to an ongoing conversation.
    User context is NOT collected again (it was already captured at start).

    Args:
        run_id: The run ID from start_seer_run()
        organization: Sentry organization
        prompt: The follow-up task/query for the agent
        user: User (for permission check)
        insert_index: Optional index to insert the message at
        on_page_context: Optional context from the user's screen

    Returns:
        int: The run ID (same as input)

    Raises:
        SeerPermissionError: If the user/org doesn't have access to Seer Explorer
        requests.HTTPError: If the Seer API request fails
    """
    # Check access
    has_access, error = has_seer_explorer_access_with_detail(organization, user)
    if not has_access:
        raise SeerPermissionError(error or "Access denied")

    path = "/v1/automation/explorer/chat"

    payload: dict[str, Any] = {
        "organization_id": organization.id,
        "query": prompt,
        "run_id": run_id,
        "insert_index": insert_index,
        "on_page_context": on_page_context,
    }

    body = orjson.dumps(payload, option=orjson.OPT_NON_STR_KEYS)

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}{path}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )

    response.raise_for_status()
    result = response.json()
    return result["run_id"]


def get_seer_run(
    run_id: int,
    organization: Organization,
    user: User | AnonymousUser | None = None,
    blocking: bool = False,
    poll_interval: float = 2.0,
    poll_timeout: float = 600.0,
) -> SeerRunState:
    """
    Get the status/result of a Seer Explorer session.

    Args:
        run_id: The run ID returned from start_seer_run()
        organization: Sentry organization
        user: User (for permission check)
        blocking: If True, blocks until the run completes (with polling)
              If False, returns current state immediately
        poll_interval: Seconds between polls when blocking=True
        poll_timeout: Maximum seconds to wait when blocking=True

    Returns:
        SeerRunState: State object with blocks, status, etc.

    Raises:
        SeerPermissionError: If the user/org doesn't have access to Seer Explorer
        requests.HTTPError: If the Seer API request fails
        TimeoutError: If polling exceeds poll_timeout when blocking=True
    """
    # Check access
    has_access, error = has_seer_explorer_access_with_detail(organization, user)
    if not has_access:
        raise SeerPermissionError(error or "Access denied")

    if blocking:
        return poll_until_done(run_id, organization, poll_interval, poll_timeout)

    return fetch_run_status(run_id, organization)


def get_seer_runs(
    organization: Organization,
    user: User | AnonymousUser | None = None,
    category_key: str | None = None,
    category_value: str | None = None,
    offset: int | None = None,
    limit: int | None = None,
) -> list[ExplorerRun]:
    """
    Get a list of Seer Explorer runs for the given organization with optional filters.

    This function supports flexible filtering by user_id, category_key, or category_value.
    At least one filter should be provided to avoid returning all runs for the org.

    Args:
        organization: Sentry organization
        user: Optional user to filter runs by (if provided, only returns runs for this user)
        category_key: Optional category key to filter by (e.g., "bug-fixer", "researcher")
        category_value: Optional category value to filter by (e.g., "issue-123", "a5b32")
        offset: Optional offset for pagination
        limit: Optional limit for pagination

    Returns:
        list[ExplorerRun]: List of runs matching the filters, sorted by most recent first

    Raises:
        SeerPermissionError: If the user/org doesn't have access to Seer Explorer
        requests.HTTPError: If the Seer API request fails
    """
    has_access, error = has_seer_explorer_access_with_detail(organization, user)
    if not has_access:
        raise SeerPermissionError(error or "Access denied")

    path = "/v1/automation/explorer/runs"

    payload: dict[str, Any] = {
        "organization_id": organization.id,
    }

    # Add optional filters
    if user and hasattr(user, "id"):
        payload["user_id"] = user.id
    if category_key is not None:
        payload["category_key"] = category_key
    if category_value is not None:
        payload["category_value"] = category_value
    if offset is not None:
        payload["offset"] = offset
    if limit is not None:
        payload["limit"] = limit

    body = orjson.dumps(payload, option=orjson.OPT_NON_STR_KEYS)

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}{path}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )

    response.raise_for_status()
    result = response.json()

    runs = [ExplorerRun(**run) for run in result.get("data", [])]
    return runs
