"""
Internal helpers for Seer Agent client.

This module contains implementation details that should not be imported directly.
Use the public client functions from client.py instead.
"""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Callable, Mapping
from datetime import datetime
from typing import Any, NotRequired, TypedDict

import orjson
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.db import router, transaction
from django.utils.timezone import now
from rest_framework.request import Request
from urllib3 import BaseHTTPResponse, HTTPConnectionPool

from sentry import features
from sentry.constants import ObjectStatus
from sentry.hybridcloud.models.outbox import (
    CellOutbox,
    OutboxDatabaseError,
    OutboxFlushError,
    outbox_context,
)
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.net.http import connection_from_url
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.utils import bulk_read_preferences_from_sentry_db
from sentry.seer.models import SeerApiError
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.seer.seer_setup import has_seer_access_with_detail
from sentry.seer.signed_seer_api import SeerViewerContext, make_signed_seer_api_request
from sentry.users.models.user import User as SentryUser
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user_option import user_option_service
from sentry.users.services.user_option.service import get_option_from_list
from sentry.utils import metrics
from sentry.utils.strings import strip_lone_surrogates

logger = logging.getLogger(__name__)

agent_connection_pool = connection_from_url(
    settings.SEER_AUTOFIX_URL,
    timeout=settings.SEER_DEFAULT_TIMEOUT,
)


class AgentStateRequest(TypedDict):
    run_id: int
    organization_id: int


class AgentChatRequest(TypedDict):
    organization_id: int
    query: str
    run_id: int | None
    insert_index: int | None
    on_page_context: str | None
    external_idempotency_key: NotRequired[str]
    page_name: NotRequired[str | None]
    user_org_context: NotRequired[dict[str, Any] | None]
    intelligence_level: NotRequired[str]
    reasoning_effort: NotRequired[str]
    is_interactive: NotRequired[bool]
    project_id: NotRequired[int]
    query_metadata: NotRequired[dict[str, str]]
    artifact_key: NotRequired[str]
    artifact_schema: NotRequired[dict[str, Any]]
    custom_tools: NotRequired[list[dict[str, Any]]]
    on_completion_hook: NotRequired[dict[str, Any]]
    category_key: NotRequired[str]
    category_value: NotRequired[str]
    metadata: NotRequired[dict[str, Any]]
    agent_run_options: NotRequired[dict[str, Any]]
    max_iterations: NotRequired[int]
    proxy_headers: NotRequired[dict[str, str] | None]
    ui_tools: NotRequired[str | None]
    monitoring_providers: NotRequired[list[dict[str, Any]]]


class AgentRunsRequest(TypedDict):
    organization_id: int
    user_id: NotRequired[int]
    category_key: NotRequired[str]
    category_value: NotRequired[str]
    offset: NotRequired[int]
    project_ids: NotRequired[list[int]]
    limit: NotRequired[int]
    expand: NotRequired[str]
    start: NotRequired[datetime]
    end: NotRequired[datetime]
    query: NotRequired[str]


class AgentUpdateRequest(TypedDict):
    run_id: int
    organization_id: int
    payload: NotRequired[dict[str, Any]]


class AgentPrStateRequest(TypedDict):
    organization_id: int
    provider: str
    pr_id: int


class SeerFeatureRunRequest(TypedDict):
    """The feature-run body as enqueued onto the SEER_RUN_CREATE outbox."""

    feature_id: str
    payload: dict[str, Any]
    agent_run_options: NotRequired[dict[str, Any]]


class SeerFeatureRunWireRequest(SeerFeatureRunRequest):
    """As sent to Seer: the outbox handler stamps the SeerRun uuid fields."""

    ref: str
    external_idempotency_key: str


class AgentReposRequest(TypedDict):
    run_id: int
    organization_id: int


def make_agent_state_request(
    body: AgentStateRequest,
    connection_pool: HTTPConnectionPool | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        connection_pool or agent_connection_pool,
        "/v1/automation/explorer/state",
        body=orjson.dumps(body, option=orjson.OPT_NON_STR_KEYS),
        viewer_context=viewer_context,
    )


def make_agent_repos_request(
    body: AgentReposRequest,
    connection_pool: HTTPConnectionPool | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        connection_pool or agent_connection_pool,
        "/v1/automation/explorer/repos",
        body=orjson.dumps(body, option=orjson.OPT_NON_STR_KEYS),
        viewer_context=viewer_context,
    )


def make_agent_chat_request(
    body: AgentChatRequest,
    connection_pool: HTTPConnectionPool | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        connection_pool or agent_connection_pool,
        "/v1/automation/explorer/chat",
        body=orjson.dumps(body, option=orjson.OPT_NON_STR_KEYS),
        viewer_context=viewer_context,
    )


def make_agent_runs_request(
    body: AgentRunsRequest,
    connection_pool: HTTPConnectionPool | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        connection_pool or agent_connection_pool,
        "/v1/automation/explorer/runs",
        body=orjson.dumps(body, option=orjson.OPT_NON_STR_KEYS),
        viewer_context=viewer_context,
    )


def make_agent_update_request(
    body: AgentUpdateRequest,
    connection_pool: HTTPConnectionPool | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        connection_pool or agent_connection_pool,
        "/v1/automation/explorer/update",
        body=orjson.dumps(body, option=orjson.OPT_NON_STR_KEYS),
        viewer_context=viewer_context,
    )


def make_agent_state_pr_request(
    body: AgentPrStateRequest,
    connection_pool: HTTPConnectionPool | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        connection_pool or agent_connection_pool,
        "/v1/automation/explorer/state/pr",
        body=orjson.dumps(body, option=orjson.OPT_NON_STR_KEYS),
        viewer_context=viewer_context,
    )


def make_feature_run_request(
    body: SeerFeatureRunWireRequest,
    connection_pool: HTTPConnectionPool | None = None,
    viewer_context: SeerViewerContext | None = None,
) -> BaseHTTPResponse:
    return make_signed_seer_api_request(
        connection_pool or agent_connection_pool,
        "/v1/automation/agent/feature/run",
        body=orjson.dumps(body, option=orjson.OPT_NON_STR_KEYS),
        viewer_context=viewer_context,
    )


def _sanitize_json_strings(payload: dict[str, Any]) -> dict[str, Any]:
    """Postgres jsonb rejects \\u0000 and lone surrogates, which show up in run
    bodies built from customer event data (e.g. exception titles). The outbox
    payload is a JSONField, so scrub strings recursively before saving."""

    def scrub(value: object) -> object:
        if isinstance(value, str):
            return strip_lone_surrogates(value).replace("\x00", "")
        if isinstance(value, dict):
            return {scrub(k): scrub(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [scrub(v) for v in value]
        return value

    return {k: scrub(v) for k, v in payload.items()}


def enqueue_seer_run(
    *,
    organization: Organization,
    run_type: SeerRunType,
    body: Mapping[str, Any],
    viewer_context: SeerViewerContext | None,
    user_id: int | None = None,
    referrer: str | None = None,
    flush: bool = True,
    on_run_created: Callable[[SeerRun], None] | None = None,
) -> SeerRun:
    """Create the SeerRun mirror and enqueue the SEER_RUN_CREATE outbox that
    dispatches it to Seer. The outbox handler stamps run-derived fields on the
    body at dispatch, so callers pass a static body here.

    on_run_created(run), if given, runs in the same transaction right after the
    SeerRun is created — use it to create associated rows atomically with the run
    (e.g. SeerAgentRun).

    flush=True: drain inline; a dispatch failure surfaces synchronously
    (mirror -> FAILED, raises SeerApiError, no retry). flush=False: leave the row
    for the async outbox runner to drain and retry.
    """
    try:
        with outbox_context(transaction.atomic(using=router.db_for_write(SeerRun)), flush=flush):
            run = SeerRun.objects.create(
                organization=organization,
                user_id=user_id,
                type=run_type,
                referrer=referrer,
                last_triggered_at=now(),
            )
            if on_run_created is not None:
                on_run_created(run)
            CellOutbox(
                shard_scope=OutboxScope.SEER_SCOPE,
                shard_identifier=run.id,
                category=OutboxCategory.SEER_RUN_CREATE,
                object_identifier=run.id,
                payload=_sanitize_json_strings(
                    {
                        "body": dict(body),
                        "viewer_context": dict(viewer_context) if viewer_context else None,
                    }
                ),
            ).save()
    except (OutboxFlushError, OutboxDatabaseError):
        metrics.incr("seer.outbox_flush_error", tags={"type": run_type.value})
        logger.exception(
            "seer.run_create.outbox_flush_error",
            extra={
                "organization_id": organization.id,
                "seer_run_id": run.id,
                "seer_run_uuid": str(run.uuid),
                "type": run_type.value,
            },
        )
        run.mirror_status = SeerRunMirrorStatus.FAILED
        run.save(update_fields=["mirror_status"])
        raise SeerApiError("Outbox flush failed for SeerRun", 500)

    if not flush:
        return run

    run.refresh_from_db()
    if run.mirror_status != SeerRunMirrorStatus.LIVE or run.seer_run_state_id is None:
        if run.mirror_status == SeerRunMirrorStatus.FAILED:
            detail = "Seer run failed during outbox drain"
        elif run.seer_run_state_id is None:
            detail = "Seer run did not mirror during outbox drain"
        else:
            detail = f"Seer run in unexpected state after outbox drain: {run.mirror_status}"
        raise SeerApiError(detail, 500)
    return run


def get_agent_state_from_pr_id(
    organization_id: int, provider: str, pr_id: int
) -> SeerRunState | None:
    body = AgentPrStateRequest(organization_id=organization_id, provider=provider, pr_id=pr_id)
    response = make_agent_state_pr_request(body)

    if response.status >= 400:
        raise SeerApiError("Seer request failed", response.status)

    result = response.json()
    if not result:
        return None

    session = result.get("session")
    if session is None:
        return None

    return SeerRunState(**session)


def has_seer_agent_access_with_detail(
    organization: Organization | RpcOrganization,
    actor: SentryUser | AnonymousUser | RpcUser | None = None,
) -> tuple[bool, str | None]:
    """
    Check if the actor has access to Seer Agent.

    This wraps has_seer_access_with_detail with an additional check for the
    seer-explorer feature flag and open team membership.

    Returns:
        tuple[bool, str | None]: (has_access, error_message)
    """
    # Check base Seer access (gen-ai-features, hide_ai_features, acknowledgement)
    has_access, error = has_seer_access_with_detail(organization, actor)
    if not has_access:
        return False, error

    if not features.has("organizations:seer-explorer", organization, actor=actor):
        return False, "Feature flag not enabled"

    # Check open team membership (the agent requires this for context)
    if not organization.flags.allow_joinleave:
        return (
            False,
            "Organization does not have open team membership enabled. Seer requires this to aggregate context across all projects and allow members to ask questions freely.",
        )

    return True, None


def collect_user_org_context(
    user: SentryUser | RpcUser | AnonymousUser | None,
    organization: Organization,
    request: Request | None = None,
) -> dict[str, Any]:
    """Collect user and organization context for a new agent run."""
    all_projects = Project.objects.filter(
        organization=organization, status=ObjectStatus.ACTIVE
    ).values("id", "slug")

    prefs_by_pid = bulk_read_preferences_from_sentry_db(
        organization.id, [p["id"] for p in all_projects]
    )
    repos_by_pid = {
        str(pid): [repo.dict() for repo in pref.repositories] for pid, pref in prefs_by_pid.items()
    }

    all_org_projects = [
        {"id": p["id"], "slug": p["slug"], "repos": repos_by_pid.get(str(p["id"])) or []}
        for p in all_projects
    ]

    if user is None or isinstance(user, AnonymousUser):
        return {
            "org_slug": organization.slug,
            "all_org_projects": all_org_projects,
        }

    try:
        member = OrganizationMember.objects.get(organization=organization, user_id=user.id)
    except OrganizationMember.DoesNotExist:
        # User is not a member of this organization (e.g., superuser accessing foreign org)
        logger.warning(
            "User attempted to access Seer Agent for organization they are not a member of",
            extra={
                "user_id": user.id,
                "organization_id": organization.id,
                "organization_slug": organization.slug,
            },
        )
        return {
            "org_slug": organization.slug,
            "all_org_projects": all_org_projects,
        }
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
    user_projects = [
        {"id": p["id"], "slug": p["slug"], "repos": repos_by_pid.get(str(p["id"])) or []}
        for p in my_projects
    ]

    # Handle name attribute - SentryUser has name
    user_name: str | None = None
    if isinstance(user, (SentryUser, RpcUser)):
        user_name = user.name

    # Get user's timezone setting (IANA timezone name, e.g., "America/Los_Angeles")
    user_options = user_option_service.get_many(filter={"user_ids": [user.id], "key": "timezone"})
    user_timezone = get_option_from_list(user_options, key="timezone")

    # Get IP address from http request, if provided
    user_ip: str | None = request.META.get("REMOTE_ADDR") if request else None

    return {
        "org_slug": organization.slug,
        "user_id": user.id,
        "user_ip": user_ip,
        "user_name": user_name,
        "user_email": user.email,
        "user_timezone": user_timezone,
        "user_teams": user_teams,
        "user_projects": user_projects,
        "all_org_projects": all_org_projects,
    }


def get_proxy_headers() -> dict[str, str] | None:
    """Build auth headers for Seer to echo back to Sentry on callbacks.

    Returns a single ``X-Viewer-Context`` JWT header, or ``None`` when no
    ViewerContext is set. Matches the format used by the standard inbound
    Seer → Sentry path (``X-Viewer-Context`` JWT, no separate signature
    header), so Sentry's middleware decodes both with the same code path.
    """
    from sentry.viewer_context import encode_viewer_context, get_viewer_context

    ctx = get_viewer_context()
    if ctx is None or ctx.user_id is None:
        return None

    if not settings.SEER_API_SHARED_SECRET:
        return None

    try:
        return {"X-Viewer-Context": encode_viewer_context(ctx)}
    except Exception:
        logger.exception("Failed to encode viewer context JWT for proxy headers")
        return None


def fetch_run_status(
    run_id: int,
    organization: Organization,
    viewer_context: SeerViewerContext | None = None,
) -> SeerRunState:
    """Fetch current run status from Seer."""
    body = AgentStateRequest(run_id=run_id, organization_id=organization.id)
    response = make_agent_state_request(body, viewer_context=viewer_context)

    if response.status >= 400:
        raise SeerApiError("Seer request failed", response.status)
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
    viewer_context: SeerViewerContext | None = None,
) -> SeerRunState:
    """Poll the run status until completion, error, awaiting_user_input, or timeout."""
    start_time = time.time()

    while True:
        result = fetch_run_status(run_id, organization, viewer_context=viewer_context)

        # Check if run is complete
        if result.status in ("completed", "error", "awaiting_user_input"):
            return result

        # Check timeout
        elapsed = time.time() - start_time
        if elapsed >= poll_timeout:
            logger.warning(
                "Seer Agent run polling timed out",
                extra={"run_id": run_id, "elapsed": elapsed},
            )
            raise TimeoutError(f"Seer run {run_id} polling exceeded {poll_timeout}s")

        # Wait before next poll
        time.sleep(poll_interval)


_WILDCARD_LABEL_MAP = {
    "\uf00dDoesNotContain\uf00d": " does not contain ",
    "\uf00dDoesNotStartWith\uf00d": " does not start with ",
    "\uf00dDoesNotEndWith\uf00d": " does not end with ",
    "\uf00dContains\uf00d": " contains ",
    "\uf00dStartsWith\uf00d": " starts with ",
    "\uf00dEndsWith\uf00d": " ends with ",
}

_ESCAPED_WILDCARD_RE = re.compile(r"\\uf00d", re.IGNORECASE)


def _normalize_wildcard_operators(text: str) -> str:
    """Replace U+F00D-delimited wildcard operators with readable labels."""
    text = _ESCAPED_WILDCARD_RE.sub("\uf00d", text)
    for pattern, label in _WILDCARD_LABEL_MAP.items():
        text = text.replace(pattern, label)
    return text


def _render_node(node: dict[str, Any], depth: int) -> str:
    """Recursively render an LLMContextSnapshot node and its children as markdown."""
    heading = "#" * min(depth + 1, 6)
    lines = [f"{heading} {(node.get('nodeType') or 'unknown').capitalize()}"]

    data = node.get("data")
    if isinstance(data, dict):
        for key, value in data.items():
            lines.append(f"- **{key}**: {orjson.dumps(value).decode()}")
    elif data is not None:
        lines.append(f"- {orjson.dumps(data).decode()}")

    for child in node.get("children", []):
        lines.append(_render_node(child, depth + 1))

    return "\n".join(lines)


_MAX_ROOT_NODES = 10


def _get_priority(node: dict[str, Any]) -> int:
    priority = node.get("priority")
    return priority if isinstance(priority, int) else 0


def snapshot_to_markdown(snapshot: dict[str, Any]) -> str:
    """Convert an LLMContextSnapshot dict to a markdown string.

    Expected shape: ``{"version": int, "nodes": [{"nodeType": str, "priority": int, "data": ..., "children": [...]}]}``
    The top-level nodes list may contain multiple root nodes (e.g. a dashboard
    and a widget-builder sidebar rendered as siblings).  Nodes are sorted by
    ``priority`` (descending, default 0) and only nodes at the highest
    priority level are rendered.  At most ``_MAX_ROOT_NODES`` are emitted to
    guard against runaway token usage.
    """
    nodes = snapshot.get("nodes", [])
    if not nodes:
        return ""
    sorted_nodes = sorted(nodes, key=_get_priority, reverse=True)
    top_priority = _get_priority(sorted_nodes[0])
    selected = [n for n in sorted_nodes if _get_priority(n) == top_priority][:_MAX_ROOT_NODES]
    preamble = (
        "> This is a structured summary of the page the user is viewing, not an exact screenshot.\n"
    )
    result = preamble + "\n".join(_render_node(node, 0) for node in selected)
    return _normalize_wildcard_operators(result)
