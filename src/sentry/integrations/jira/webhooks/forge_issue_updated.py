from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from typing import Any

from django.conf import settings
from django.db import OperationalError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc.service import RpcRemoteException
from sentry.integrations.jira.forge.invocation_token import (
    ForgeInvocationTokenError,
    ForgeSigningKeysUnavailableError,
    jira_cloud_id,
    jira_cloud_id_from_claims,
    verify_forge_request,
)
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.scope import bind_org_context_from_integration
from sentry.ratelimits.config import RateLimitConfig
from sentry.shared_integrations.exceptions import (
    ApiConnectionResetError,
    ApiError,
    ApiHostError,
    ApiRateLimitedError,
    ApiTimeoutError,
)
from sentry.silo.base import SiloMode
from sentry.silo.util import WEBHOOK_DELIVERY_SIGNATURE_HEADER, verify_webhook_delivery_signature
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import jwt

from ..utils import handle_assignee_change, handle_issue_moved, handle_status_change
from .base import JiraWebhookBase

logger = logging.getLogger(__name__)

# The manifest's `avi:jira:updated:issue` trigger. Any module of the app can call the
# remote, including UI modules a Jira user drives, so only this one may send events.
FORGE_ISSUE_UPDATED_MODULE_KEY = "issue-updated"


class _TemporaryFailure(Exception):
    pass


@cell_silo_endpoint
class JiraForgeIssueUpdatedWebhook(JiraWebhookBase):
    owner = ApiOwner.PROJECT_MANAGEMENT_INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.IP: RateLimit(limit=100, window=1),
                RateLimitCategory.USER: RateLimit(limit=100, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=1),
            },
        }
    )
    """
    Applies Forge `avi:jira:updated:issue` events. Control verifies each event's Forge
    invocation token on arrival and replays it here through WebhookPayload, signing the
    delivery. The token may expire while the payload waits, so this trusts the signature
    instead of checking the token again.
    """

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            # No control silo queued this, so the Forge token is checked here instead.
            try:
                invocation = verify_forge_request(request)
            except ForgeSigningKeysUnavailableError:
                return self.respond(status=503)
            except ForgeInvocationTokenError:
                return self.respond({"detail": "Invalid Forge invocation token"}, status=401)
            if invocation.module_key != FORGE_ISSUE_UPDATED_MODULE_KEY:
                return self.respond({"detail": "Not the issue-updated trigger"}, status=403)
            cloud_id = jira_cloud_id(invocation)
            installation_id: str | None = invocation.installation_id
        else:
            authorization = request.headers.get("Authorization")
            if not verify_webhook_delivery_signature(
                request.get_full_path(),
                authorization,
                request.body,
                request.headers.get(WEBHOOK_DELIVERY_SIGNATURE_HEADER),
            ):
                return self.respond({"detail": "Invalid delivery signature"}, status=401)
            _, _, token = (authorization or "").partition(" ")
            claims = jwt.peek_claims(token)
            cloud_id = jira_cloud_id_from_claims(claims)
            installation_id = (claims.get("app") or {}).get("installationId")

        event = request.data
        if cloud_id is None or not _is_issue_change(event):
            return self.respond(status=202)

        integration = integration_service.get_integration(
            provider=IntegrationProviderSlug.JIRA.value,
            external_id=cloud_id,
            status=ObjectStatus.ACTIVE,
        )
        forge = (integration.metadata.get("forge") or {}) if integration else {}
        if integration is None or installation_id != forge.get("installation_id"):
            # Uninstalled or reinstalled since control queued it.
            return self.respond(status=202)
        bind_org_context_from_integration(integration.id, {"webhook": "forge_issue_updated"})

        try:
            # Rekey first, since the other handlers look the issue up by its new key.
            # Assignee goes last because its email lookup is the only call to Jira, so a
            # failure there can't hold up the status change.
            _apply_change(handle_issue_moved, integration, event)
            _apply_change(handle_status_change, integration, event)
            _apply_change(
                handle_assignee_change,
                integration,
                event,
                use_email_scope=settings.JIRA_USE_EMAIL_SCOPE,
            )
        except _TemporaryFailure:
            # WebhookPayload retries a 5xx, in order with this issue's later events. The
            # handlers are idempotent, so the whole event is safe to apply again.
            return self.respond(status=503)
        return self.respond(status=202)


def _is_issue_change(event: Any) -> bool:
    """Whether the event has the fields the handlers read without checking."""
    if not isinstance(event, dict) or not isinstance(event.get("changelog"), dict):
        return False
    issue = event.get("issue")
    return (
        isinstance(issue, dict)
        and isinstance(issue.get("id"), str)
        and isinstance(issue.get("key"), str)
    )


def _apply_change(
    handler: Callable[..., None],
    integration: RpcIntegration,
    event: Mapping[str, Any],
    **kwargs: Any,
) -> None:
    try:
        handler(integration, event, **kwargs)
    except Exception as e:
        if _is_temporary(e):
            raise _TemporaryFailure from e
        # Retrying wouldn't help, such as a 404 for a deleted Jira account, so only this
        # change is dropped and the rest of the event still applies.
        logger.exception(
            "jira.forge.issue_updated.failed",
            extra={"integration_id": integration.id, "handler": handler.__name__},
        )


def _is_temporary(error: Exception) -> bool:
    if isinstance(
        error,
        (
            ApiConnectionResetError,
            ApiHostError,
            ApiRateLimitedError,
            ApiTimeoutError,
            OperationalError,
            RpcRemoteException,
        ),
    ):
        return True
    # No status means Jira never responded, such as a broken connection.
    return isinstance(error, ApiError) and (error.code is None or error.code >= 500)
