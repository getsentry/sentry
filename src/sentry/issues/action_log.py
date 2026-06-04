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
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Group Action Log — experimental module for tracking who did what to an issue and how.
# Storage backend not yet wired up; actions are emitted as structured logs and metrics only.
#
# Most mutation sites should use publish_action_from_context(), which reads attribution
# from a ContextVar set at the request boundary via action_context_scope().
# Use publish_action() directly only for shallow endpoint-level actions (VIEW, COMMENT, etc.).
#
# If you're adding a new caller to an instrumented function (e.g. GroupAssignee.objects.assign),
# wrap it with action_context_scope() so the action gets proper source attribution.

MCP_USER_AGENT_PREFIX = "sentry-mcp/"
MCP_CLIENT_FAMILY_HEADER = "HTTP_X_SENTRY_MCP_CLIENT_FAMILY"
SEER_REFERRER_HEADER = "HTTP_X_SEER_REFERRER"

# Standardized client families the MCP buckets its callers into and forwards via
# X-Sentry-MCP-Client-Family (source of truth: client-family.ts in getsentry/sentry-mcp).
KNOWN_MCP_CLIENT_FAMILIES = frozenset(
    {"claude-code", "cursor", "copilot", "opencode", "claude-desktop", "codex"}
)
MCP_CATCHALL_CLIENT_FAMILIES = frozenset({"other", "unknown"})


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
    UNKNOWN = (
        "unknown"  # fallback when ActionContext is missing; indicates a gap in instrumentation
    )


def resolve_action_source(request: Request) -> str:
    """
    Determine the ActionSource from a request. Priority: MCP > Seer > frontend > CLI > API.
    """
    user_agent = request.META.get("HTTP_USER_AGENT", "")

    if user_agent.startswith(MCP_USER_AGENT_PREFIX):
        family = request.META.get(MCP_CLIENT_FAMILY_HEADER, "").strip().lower()
        if family in KNOWN_MCP_CLIENT_FAMILIES:
            return f"{ActionSource.MCP}:{family}"
        if family and family not in MCP_CATCHALL_CLIENT_FAMILIES:
            # Values outside this set are logged so we know to add new ones
            logger.warning(
                "issue.action_log.unrecognized_mcp_client_family",
                extra={"client_family": family},
            )
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
def action_context_scope(source: str, actor_id: int | None) -> Generator[None]:
    """
    Set action attribution context for the duration of a block. Must be set before
    any code path that calls publish_action_from_context().
    """
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
    """
    Record an issue action directly. Use this for shallow endpoint-level actions
    where the request is in scope (VIEW, COMMENT, TRIGGER_AUTOFIX). For mutation
    sites deeper in the stack, prefer publish_action_from_context().
    """
    actor_type = ActorType.USER if actor_id is not None else ActorType.SYSTEM
    metrics.incr("issue.action_log", tags={"action": action, "source": source})
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
    """
    Record an issue action using the current ActionContext. This is the primary API
    for mutation sites (assign, resolve, etc.) where the request is not in scope.
    Requires action_context_scope() to have been set upstream. If context is missing,
    logs an error to Sentry and records the action with source=UNKNOWN.
    """
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
