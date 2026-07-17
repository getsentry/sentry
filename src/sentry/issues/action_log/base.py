from __future__ import annotations

import logging

from django.http import HttpRequest
from rest_framework.request import Request

from sentry.auth.services.auth import AuthenticatedToken
from sentry.issues.action_log.types import SYSTEM_ACTOR, ActionSource, GroupActionActor
from sentry.middleware import is_frontend_request
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils.http import is_mcp_request

logger = logging.getLogger(__name__)

MCP_CLIENT_FAMILY_HEADER = "HTTP_X_SENTRY_MCP_CLIENT_FAMILY"
SEER_REFERRER_HEADER = "HTTP_X_SEER_REFERRER"

# Standardized client families the MCP buckets its callers into and forwards via
# X-Sentry-MCP-Client-Family (source of truth: client-family.ts in getsentry/sentry-mcp).
KNOWN_MCP_CLIENT_FAMILIES = frozenset(
    {"claude-code", "cursor", "copilot", "opencode", "claude-desktop", "codex"}
)
MCP_CATCHALL_CLIENT_FAMILIES = frozenset({"other", "unknown"})


def resolve_action_source(request: Request) -> str:
    """
    Determine the ActionSource from a request. Priority: MCP > Seer > frontend > CLI > API.
    """
    user_agent = request.META.get("HTTP_USER_AGENT", "")

    if is_mcp_request(request):
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


def resolve_action_actor(request: Request | HttpRequest) -> GroupActionActor:
    """
    Determine *who* initiated an action from a request, mirroring resolve_action_source (*how*).

    Region-side ``request.auth`` is an ``AuthenticatedToken`` whose ``kind`` distinguishes the
    caller: an org/legacy token is the organization acting, a token tied to an ApiApplication is
    an integration (Sentry App) acting, and everything else authenticated is the user. Falls back
    to SYSTEM_ACTOR when there is no authenticated caller.
    """
    if hasattr(request, "auth"):
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

                    sentry_app = app_service.get_by_application_id(
                        application_id=auth.application_id
                    )
                    if sentry_app is not None:
                        return GroupActionActor.sentry_app(sentry_app.id)
                if auth.user_id is not None:
                    return GroupActionActor.user(auth.user_id)

    user = request.user
    if isinstance(user, (User, RpcUser)):
        return GroupActionActor.user(user.id)

    return SYSTEM_ACTOR
