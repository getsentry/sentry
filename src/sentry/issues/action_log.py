from __future__ import annotations

import logging
from enum import StrEnum
from typing import Any

from rest_framework.request import Request

from sentry.middleware import is_frontend_request

logger = logging.getLogger(__name__)

MCP_CLIENT_ID_HEADER = "HTTP_X_SENTRY_MCP_CLIENT_ID"
MCP_CLIENT_NAME_HEADER = "HTTP_X_SENTRY_MCP_CLIENT_NAME"
SEER_REFERRER_HEADER = "HTTP_X_SEER_REFERRER"

MCP_APPLICATION_ID: int | None = None

KNOWN_MCP_CLIENTS: dict[str, str] = {
    "claude code": "claude-code",
    "claude-code": "claude-code",
    "cursor": "cursor",
    "copilot": "copilot",
    "windsurf": "windsurf",
}


class ActionSource(StrEnum):
    WEB = "web"
    SENTRY_CLI = "sentry-cli"
    API = "api"
    SYSTEM = "system"
    MCP = "mcp"
    SEER_EXPLORER = "seer:explorer"
    SEER_SLACK = "seer:slack"
    SLACK = "slack"
    DISCORD = "discord"
    MSTEAMS = "msteams"
    GITHUB = "github"
    GITLAB = "gitlab"
    JIRA = "jira"


def _get_mcp_application_id() -> int | None:
    global MCP_APPLICATION_ID
    if MCP_APPLICATION_ID is not None:
        return MCP_APPLICATION_ID

    from sentry.models.apiapplication import ApiApplication

    try:
        app = ApiApplication.objects.filter(name__icontains="sentry-mcp").first()
        if app:
            MCP_APPLICATION_ID = app.id
            return MCP_APPLICATION_ID
    except Exception:
        logger.exception("Failed to look up MCP application ID")

    return None


def resolve_action_source(request: Request | None) -> str:
    if request is None:
        return ActionSource.SYSTEM

    # MCP: trust client headers only when token belongs to the MCP OAuth app
    application_id = getattr(request.auth, "application_id", None)
    mcp_app_id = _get_mcp_application_id()
    if mcp_app_id and application_id == mcp_app_id:
        client_name = request.META.get(MCP_CLIENT_NAME_HEADER, "")
        normalized = client_name.strip().lower()
        slug = KNOWN_MCP_CLIENTS.get(normalized)
        if slug:
            return f"mcp:{slug}"
        return ActionSource.MCP

    # Seer: detect via X-Seer-Referrer header (trust but label)
    seer_referrer = request.META.get(SEER_REFERRER_HEADER, "")
    if seer_referrer:
        if "slack" in seer_referrer.lower():
            return ActionSource.SEER_SLACK
        return ActionSource.SEER_EXPLORER

    # Seer RPC: authenticated via HMAC shared secret
    from sentry.seer.endpoints.seer_rpc import SeerRpcSignatureAuthentication

    if isinstance(
        getattr(request, "successful_authenticator", None), SeerRpcSignatureAuthentication
    ):
        return ActionSource.SEER_EXPLORER

    if is_frontend_request(request):
        return ActionSource.WEB

    user_agent = request.META.get("HTTP_USER_AGENT", "")
    if user_agent.startswith("sentry-cli/"):
        return ActionSource.SENTRY_CLI

    return ActionSource.API


class ActorType(StrEnum):
    USER = "user"
    SYSTEM = "system"


class ActionType(StrEnum):
    VIEW = "view"
    RESOLVE = "resolve"
    UNRESOLVE = "unresolve"
    ARCHIVE = "archive"
    ASSIGN = "assign"
    UNASSIGN = "unassign"
    SET_PRIORITY = "set_priority"
    MERGE = "merge"
    DELETE = "delete"
    BOOKMARK = "bookmark"
    COMMENT = "comment"
    SUBSCRIBE = "subscribe"
    UNSUBSCRIBE = "unsubscribe"
    MARK_REVIEWED = "mark_reviewed"
    TRIGGER_AUTOFIX = "trigger_autofix"


def publish_action(
    *,
    action: ActionType,
    source: str,
    group_id: int,
    organization_id: int,
    project_id: int,
    actor_id: int | None = None,
    metadata: dict[str, Any] | None = None,
    idempotency_key: str | None = None,
) -> None:
    """
    No-op publisher — emits a structured log line and a metric counter.
    Will be swapped for the real Action Log publisher when available.
    """
    actor_type = ActorType.USER if actor_id is not None else ActorType.SYSTEM
    logger.info(
        "issue.action_log",
        extra={
            "action": action,
            "source": source,
            "group_id": group_id,
            "organization_id": organization_id,
            "project_id": project_id,
            "actor_type": actor_type,
            "actor_id": actor_id,
            "metadata": metadata or {},
            "idempotency_key": idempotency_key,
        },
    )
