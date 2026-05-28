from __future__ import annotations

import logging
from collections.abc import Generator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from rest_framework.request import Request

from sentry.middleware import is_frontend_request

logger = logging.getLogger(__name__)

MCP_CLIENT_NAME_HEADER = "HTTP_X_SENTRY_MCP_CLIENT_NAME"
SEER_REFERRER_HEADER = "HTTP_X_SEER_REFERRER"

MCP_APP_ID_CACHE_KEY = "action_log.mcp_application_id"
MCP_APP_ID_CACHE_TTL = 300

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
    SLACK_STAGING = "slack_staging"
    DISCORD = "discord"
    MSTEAMS = "msteams"
    GITHUB = "github"
    GITHUB_ENTERPRISE = "github_enterprise"
    GITLAB = "gitlab"
    JIRA = "jira"
    JIRA_SERVER = "jira_server"
    AZURE_DEVOPS = "vsts"
    BITBUCKET = "bitbucket"
    BITBUCKET_SERVER = "bitbucket_server"
    PAGERDUTY = "pagerduty"
    OPSGENIE = "opsgenie"
    PERFORCE = "perforce"
    UNKNOWN = "unknown"


def _get_mcp_application_id() -> int | None:
    from django.core.cache import cache

    cached = cache.get(MCP_APP_ID_CACHE_KEY)
    if cached is not None:
        return cached if cached > 0 else None

    from sentry.models.apiapplication import ApiApplication

    try:
        app = ApiApplication.objects.filter(name__icontains="sentry-mcp").first()
        app_id = app.id if app else 0
    except Exception:
        logger.exception("Failed to look up MCP application ID")
        return None

    cache.set(MCP_APP_ID_CACHE_KEY, app_id, MCP_APP_ID_CACHE_TTL)
    return app_id if app_id > 0 else None


def resolve_action_source(request: Request | None) -> str:
    if request is None:
        return ActionSource.SYSTEM

    application_id = getattr(request.auth, "application_id", None)
    mcp_app_id = _get_mcp_application_id() if application_id is not None else None
    if mcp_app_id and application_id == mcp_app_id:
        client_name = request.META.get(MCP_CLIENT_NAME_HEADER, "")
        normalized = client_name.strip().lower()
        slug = KNOWN_MCP_CLIENTS.get(normalized)
        if slug:
            return f"{ActionSource.MCP}:{slug}"
        return ActionSource.MCP

    seer_referrer = request.META.get(SEER_REFERRER_HEADER, "")
    if seer_referrer:
        if "slack" in seer_referrer.lower():
            return ActionSource.SEER_SLACK
        return ActionSource.SEER_EXPLORER

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
    MERGE_INTO_OTHER = "merge_into_other"
    MERGE_FROM_OTHER = "merge_from_other"
    DELETE = "delete"
    BOOKMARK = "bookmark"
    COMMENT = "comment"
    COMMENT_EDIT = "comment_edit"
    COMMENT_DELETE = "comment_delete"
    SUBSCRIBE = "subscribe"
    UNSUBSCRIBE = "unsubscribe"
    MARK_REVIEWED = "mark_reviewed"
    TRIGGER_AUTOFIX = "trigger_autofix"


@dataclass(frozen=True)
class ActionContext:
    source: str
    actor_id: int | None = None


_action_context: ContextVar[ActionContext | None] = ContextVar("action_context", default=None)


@contextmanager
def action_context_scope(source: str, actor_id: int | None = None) -> Generator[None]:
    token = _action_context.set(ActionContext(source=source, actor_id=actor_id))
    try:
        yield
    finally:
        _action_context.reset(token)


def get_action_context() -> ActionContext | None:
    return _action_context.get()


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


def publish_action_from_context(
    *,
    action: ActionType,
    group_id: int,
    organization_id: int,
    project_id: int,
    metadata: dict[str, Any] | None = None,
) -> None:
    ctx = get_action_context()
    if ctx is None:
        logger.error(
            "publish_action_from_context called without ActionContext",
            extra={"action": action, "group_id": group_id},
        )
        source: str = ActionSource.UNKNOWN
        actor_id = None
    else:
        source = ctx.source
        actor_id = ctx.actor_id
    publish_action(
        action=action,
        source=source,
        group_id=group_id,
        organization_id=organization_id,
        project_id=project_id,
        actor_id=actor_id,
        metadata=metadata,
    )
