from __future__ import annotations

import logging
from collections.abc import Generator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from enum import StrEnum

from django.db import IntegrityError, router, transaction
from rest_framework.request import Request

from sentry import options
from sentry.auth.services.auth import AuthenticatedToken
from sentry.issues.action_log.types import SYSTEM_ACTOR, GroupAction, GroupActionActor
from sentry.issues.groupactionlogentry import GroupActionLogEntry
from sentry.middleware import is_frontend_request
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
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
                "group.action_log.unrecognized_mcp_client_family",
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


def resolve_action_actor(request: Request) -> GroupActionActor:
    """
    Determine *who* initiated an action from a request, mirroring resolve_action_source (*how*).

    Region-side ``request.auth`` is an ``AuthenticatedToken`` whose ``kind`` distinguishes the
    caller: an org/legacy token is the organization acting, a token tied to an ApiApplication is
    an integration (Sentry App) acting, and everything else authenticated is the user. Falls back
    to SYSTEM_ACTOR when there is no authenticated caller.
    """
    auth = request.auth
    if isinstance(auth, AuthenticatedToken):
        if auth.kind in ("org_auth_token", "api_key"):
            if auth.organization_id is not None:
                return GroupActionActor.org(auth.organization_id)
        elif auth.kind == "api_token":
            user = request.user
            # Gate on is_sentry_app (the app's proxy user), not application_id: an OAuth client
            # acting for a user (e.g. the MCP) also has an application_id but stays USER.
            if (
                isinstance(user, (User, RpcUser))
                and user.is_sentry_app
                and auth.application_id is not None
            ):
                # Imported here, not at module load, to avoid a circular import.
                from sentry.sentry_apps.services.app import app_service

                sentry_app = app_service.get_by_application_id(application_id=auth.application_id)
                if sentry_app is not None:
                    return GroupActionActor.sentry_app(sentry_app.id)
            if auth.user_id is not None:
                return GroupActionActor.user(auth.user_id)

    user = request.user
    if isinstance(user, (User, RpcUser)):
        return GroupActionActor.user(user.id)

    return SYSTEM_ACTOR


@dataclass(frozen=True)
class ActionContext:
    source: str
    actor: GroupActionActor = SYSTEM_ACTOR


_action_context: ContextVar[ActionContext | None] = ContextVar("action_context", default=None)


@contextmanager
def action_context_scope(source: str, actor: GroupActionActor) -> Generator[None]:
    """
    Set action attribution context for the duration of a block. Must be set before
    any code path that calls publish_action_from_context().
    """
    token = _action_context.set(ActionContext(source=source, actor=actor))
    try:
        yield
    finally:
        _action_context.reset(token)


def get_action_context() -> ActionContext | None:
    return _action_context.get()


class DuplicateActionError(Exception):
    """Raised when an idempotency_key conflicts with an existing entry."""


def publish_action(
    action: GroupAction,
    *,
    source: str,
    group_id: int,
    organization_id: int,
    project_id: int,
    actor: GroupActionActor = SYSTEM_ACTOR,
    idempotency_key: str | None = None,
) -> None:
    """
    Record an issue action. Raises DuplicateActionError if an idempotency_key
    conflicts with an existing entry.

    Use this for shallow endpoint-level actions where the request is in scope
    (VIEW, COMMENT, TRIGGER_AUTOFIX). For mutation sites deeper in the stack,
    prefer publish_action_from_context().
    """
    action_name = action.get_type().name.lower()
    metrics.incr(
        "issues.action_log",
        tags={
            "action": action_name,
            "source": source,
            "actor_type": actor.actor_type.name.lower(),
        },
    )
    logger.info(
        "group.action_log",
        extra={
            "action": action_name,
            "source": source,
            # IDs are stringified so large values aren't rendered in scientific
            # notation by downstream log tooling.
            "group_id": str(group_id),
            "organization_id": str(organization_id),
            "project_id": str(project_id),
            "actor_type": actor.actor_type.name.lower(),
            "actor_id": str(actor.actor_id),
            "metadata": action.dict(),
            "idempotency_key": idempotency_key,
        },
    )

    # Don't write to the database until we're confident in the action schemas.
    if not options.get("issues.action-log.write-to-db"):
        return

    kwargs = dict(
        group_id=group_id,
        project_id=project_id,
        type=action.get_type().value,
        actor_type=actor.actor_type.value,
        actor_id=actor.actor_id,
        source=source,
        data=action.dict(),
        idempotency_key=idempotency_key,
    )

    if idempotency_key is None:
        GroupActionLogEntry.objects.create(**kwargs)
        return

    try:
        with transaction.atomic(using=router.db_for_write(GroupActionLogEntry)):
            GroupActionLogEntry.objects.create(**kwargs)
    except IntegrityError as e:
        cause = e.__cause__
        constraint = getattr(getattr(cause, "diag", None), "constraint_name", None)
        if constraint == "uniq_groupactionlogentry_group_idempotency_key":
            raise DuplicateActionError(
                f"Action already recorded for group {group_id} "
                f"with idempotency_key={idempotency_key!r}"
            ) from e
        raise


def publish_action_from_context(
    action: GroupAction,
    *,
    group_id: int,
    organization_id: int,
    project_id: int,
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
            extra={"action": action.get_type().name.lower(), "group_id": str(group_id)},
        )
        source: str = ActionSource.UNKNOWN
        actor = SYSTEM_ACTOR
    else:
        source = ctx.source
        actor = ctx.actor
    publish_action(
        action,
        source=source,
        group_id=group_id,
        organization_id=organization_id,
        project_id=project_id,
        actor=actor,
    )
