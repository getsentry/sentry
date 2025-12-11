"""
Internal helpers for Seer Explorer client.

This module contains implementation details that should not be imported directly.
Use the public client functions from client.py instead.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import orjson
import requests
from django.conf import settings
from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.seer.explorer.client_models import SeerRunState
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.users.models.user import User as SentryUser
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user_option import user_option_service
from sentry.users.services.user_option.service import get_option_from_list

logger = logging.getLogger(__name__)


def has_seer_explorer_access_with_detail(
    organization: Organization, actor: SentryUser | AnonymousUser | RpcUser | None = None
) -> tuple[bool, str | None]:
    """
    Check if the actor has access to Seer Explorer.

    This wraps has_seer_access_with_detail with an additional check for the
    seer-explorer feature flag and open team membership.

    Returns:
        tuple[bool, str | None]: (has_access, error_message)
    """
    # Check base Seer access (gen-ai-features, hide_ai_features, acknowledgement)
    has_access, error = has_seer_access_with_detail(organization, actor)
    if not has_access:
        return False, error

    # Check seer-explorer specific feature flag
    if not features.has("organizations:seer-explorer", organization, actor=actor):
        return False, "Feature flag not enabled"

    # Check open team membership (Explorer requires this for context)
    if not organization.flags.allow_joinleave:
        return (
            False,
            "Organization does not have open team membership enabled. Seer requires this to aggregate context across all projects and allow members to ask questions freely.",
        )

    return True, None


def collect_user_org_context(
    user: SentryUser | AnonymousUser | None, organization: Organization
) -> dict[str, Any]:
    """Collect user and organization context for a new Explorer run."""
    all_projects = Project.objects.filter(
        organization=organization, status=ObjectStatus.ACTIVE
    ).values("id", "slug")
    all_org_projects = [{"id": p["id"], "slug": p["slug"]} for p in all_projects]

    if user is None or isinstance(user, AnonymousUser):
        return {
            "org_slug": organization.slug,
            "user_id": None,
            "user_name": None,
            "user_email": None,
            "user_timezone": None,
            "user_teams": [],
            "user_projects": [],
            "all_org_projects": all_org_projects,
        }

    member = OrganizationMember.objects.get(organization=organization, user_id=user.id)
    user_teams = [{"id": t.id, "slug": t.slug} for t in member.get_teams()]
    my_projects = (
        Project.objects.filter(
            organization=organization,
            teams__organizationmember__user_id=user.id,
            status=ObjectStatus.ACTIVE,
        )
        .distinct()
        .values("id", "slug")
    )
    user_projects = [{"id": p["id"], "slug": p["slug"]} for p in my_projects]

    # Handle name attribute - SentryUser has name
    user_name: str | None = None
    if isinstance(user, SentryUser):
        user_name = user.name

    # Get user's timezone setting (IANA timezone name, e.g., "America/Los_Angeles")
    user_options = user_option_service.get_many(filter={"user_ids": [user.id], "key": "timezone"})
    user_timezone = get_option_from_list(user_options, key="timezone")

    return {
        "org_slug": organization.slug,
        "user_id": user.id,
        "user_name": user_name,
        "user_email": user.email,
        "user_timezone": user_timezone,
        "user_teams": user_teams,
        "user_projects": user_projects,
        "all_org_projects": all_org_projects,
    }


def fetch_run_status(run_id: int, organization: Organization) -> SeerRunState:
    """Fetch current run status from Seer."""
    path = "/v1/automation/explorer/state"

    body = orjson.dumps(
        {
            "run_id": run_id,
            "organization_id": organization.id,
        },
        option=orjson.OPT_NON_STR_KEYS,
    )

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}{path}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )

    response.raise_for_status()
    data = response.json()

    session = data.get("session")
    if not session:
        raise ValueError(f"No session found for run_id {run_id}")

    return SeerRunState(**session)


def poll_until_done(
    run_id: int,
    organization: Organization,
    poll_interval: float,
    poll_timeout: float,
) -> SeerRunState:
    """Poll the run status until completion, error, awaiting_user_input, or timeout."""
    start_time = time.time()

    while True:
        result = fetch_run_status(run_id, organization)

        # Check if run is complete
        if result.status in ("completed", "error", "awaiting_user_input"):
            return result

        # Check timeout
        elapsed = time.time() - start_time
        if elapsed >= poll_timeout:
            logger.warning(
                "Seer Explorer run polling timed out",
                extra={"run_id": run_id, "elapsed": elapsed},
            )
            raise TimeoutError(f"Seer run {run_id} polling exceeded {poll_timeout}s")

        # Wait before next poll
        time.sleep(poll_interval)
