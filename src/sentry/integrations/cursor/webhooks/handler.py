from __future__ import annotations

import hashlib
import hmac
import logging
import re
from typing import Any
from urllib.parse import urlparse

import orjson
from django.http import HttpRequest, HttpResponse
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.exceptions import MethodNotAllowed, ParseError, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, cell_silo_endpoint
from sentry.api.utils import to_valid_int_id
from sentry.integrations.cursor.integration import CursorAgentIntegration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.utils.webhook_viewer_context import webhook_viewer_context
from sentry.models.pullrequest import PullRequestAttributionSignalType
from sentry.pr_metrics.attribution import attribute_delegated_agent_pull_request
from sentry.seer.autofix.coding_agent_handoffs import sync_coding_agent_status
from sentry.seer.autofix.constants import CodingAgentStatus
from sentry.seer.autofix.utils import CodingAgentResult

logger = logging.getLogger(__name__)


@cell_silo_endpoint
class CursorWebhookEndpoint(Endpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()

    # Set per-request in post(); a fresh endpoint instance is created per request.
    organization_id: int

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        if request.method != "POST":
            raise MethodNotAllowed(request.method or "unknown")
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request, organization_id: str) -> Response:
        org_id = to_valid_int_id("organization_id", organization_id, raise_404=True)
        try:
            payload = orjson.loads(request.body)
        except orjson.JSONDecodeError:
            logger.warning("cursor_webhook.invalid_json")
            raise ParseError("Invalid JSON")

        event_type = payload.get("event", payload.get("event_type", "unknown"))

        if not self._validate_signature(request, request.body, org_id):
            logger.warning("cursor_webhook.invalid_signature")
            raise PermissionDenied("Invalid signature")

        self.organization_id = org_id
        with webhook_viewer_context(org_id):
            self._process_webhook(payload)
        logger.info("cursor_webhook.success", extra={"event_type": event_type})
        return self.respond(status=204)

    def _get_cursor_integration_secret(self, organization_id: int) -> str | None:
        """Get webhook secret from Cursor integration."""
        integrations = integration_service.get_integrations(
            organization_id=organization_id, providers=["cursor"]
        )

        if not integrations:
            logger.warning(
                "cursor_webhook.no_integrations", extra={"organization_id": organization_id}
            )
            return None

        if len(integrations) > 1:
            logger.warning(
                "cursor_webhook.multiple_integrations",
                extra={
                    "organization_id": organization_id,
                    "integration_ids": [integration.id for integration in integrations],
                },
            )
            return None

        installation = integrations[0].get_installation(organization_id)

        if not isinstance(installation, CursorAgentIntegration):
            logger.warning(
                "cursor_webhook.unexpected_installation_type",
                extra={
                    "integration_id": integrations[0].id,
                    "organization_id": organization_id,
                    "type": type(installation).__name__,
                },
            )
            return None

        return installation.webhook_secret

    def _validate_signature(self, request: Request, raw_body: bytes, organization_id: int) -> bool:
        """Validate webhook signature."""
        signature = request.headers.get("X-Webhook-Signature")

        # Get webhook secret from integration
        secret = self._get_cursor_integration_secret(organization_id)

        if not signature:
            logger.warning("cursor_webhook.no_signature_provided")
            raise PermissionDenied("No signature provided")

        if not secret:
            logger.warning("cursor_webhook.no_webhook_secret")
            raise PermissionDenied("No webhook secret set")

        # Remove "sha256=" prefix if present
        if signature.startswith("sha256="):
            signature = signature[7:]

        expected_signature = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

        is_valid = constant_time_compare(expected_signature, signature)
        if not is_valid:
            logger.warning("cursor_webhook.signature_mismatch")

        return is_valid

    def _process_webhook(self, payload: dict[str, Any]) -> None:
        """Process webhook payload based on event type."""
        event_type = payload.get("event", "unknown")

        handlers = {
            "unknown": self._handle_unknown_event,
            "statusChange": self._handle_status_change,
        }

        handler = handlers.get(event_type, self._handle_unknown_event)
        handler(payload)

    def _handle_unknown_event(self, payload: dict[str, Any]) -> None:
        """Handle unknown event types."""
        logger.warning("cursor_webhook.unknown_event", extra=payload)

    def _handle_status_change(self, payload: dict[str, Any]) -> None:
        """Handle status change events."""
        agent_id = payload.get("id")
        cursor_status = payload.get("status")
        source = payload.get("source", {})
        target = payload.get("target", {})
        pr_url = target.get("prUrl")
        branch_name = target.get("branchName")
        agent_url = target.get("url")
        summary = payload.get("summary")

        if not agent_id or not cursor_status:
            logger.warning(
                "cursor_webhook.status_change_missing_data",
                extra={"agent_id": agent_id, "status": cursor_status},
            )
            return

        status = CodingAgentStatus.from_cursor_status(cursor_status)
        if not status:
            logger.warning(
                "cursor_webhook.unknown_status",
                extra={"cursor_status": cursor_status, "agent_id": agent_id},
            )
            status = CodingAgentStatus.FAILED

        logger.info(
            "cursor_webhook.status_change",
            extra={
                "agent_id": agent_id,
                "cursor_status": cursor_status,
                "status": status.value,
                "pr_url": pr_url,
                "summary": summary,
            },
        )

        repo_url = source.get("repository", None)
        if not repo_url:
            logger.warning(
                "cursor_webhook.repo_not_found",
                extra={"agent_id": agent_id, "source": source},
            )
            return

        # Ensure the repo URL has a protocol, on their docs it says it should but we found it doesn't?
        if not repo_url.startswith("https://"):
            repo_url = f"https://{repo_url}"

        parsed = urlparse(repo_url)
        if parsed.netloc != "github.com":
            logger.warning(
                "cursor_webhook.not_github_repo",
                extra={"agent_id": agent_id, "repo": repo_url},
            )
            return

        repo_provider = "github"
        repo_full_name = parsed.path.lstrip("/")

        # If the repo isn't in the owner/repo format we can't work with it
        # Allow dots in the repository name segment (owner.repo is common)
        if not re.match(r"^[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+$", repo_full_name):
            logger.warning(
                "cursor_webhook.repo_format_invalid",
                extra={"agent_id": agent_id, "source": source},
            )
            return

        if pr_url and not self._validate_pr_url(pr_url, repo_full_name):
            logger.warning(
                "cursor_webhook.invalid_pr_url",
                extra={"agent_id": agent_id, "pr_url": pr_url},
            )
            pr_url = None

        result = CodingAgentResult(
            repo_full_name=repo_full_name,
            repo_provider=repo_provider,
            description=summary or f"Agent {status.lower()}",
            pr_url=pr_url if status == CodingAgentStatus.COMPLETED else None,
            branch_name=branch_name,
        )

        known_to_seer = sync_coding_agent_status(
            agent_id=agent_id,
            organization_id=self.organization_id,
            status=status,
            agent_url=agent_url,
            result=result,
        )

        if known_to_seer and status == CodingAgentStatus.COMPLETED and pr_url:
            try:
                attribute_delegated_agent_pull_request(
                    organization_id=self.organization_id,
                    signal_type=PullRequestAttributionSignalType.SEER_DELEGATED_CURSOR,
                    repo_full_name=repo_full_name,
                    repo_provider=repo_provider,
                    pr_url=pr_url,
                    agent_id=agent_id,
                )
            except Exception:
                logger.exception(
                    "cursor_webhook.pr_attribution_failed",
                    extra={"agent_id": agent_id, "pr_url": pr_url},
                )
        elif status == CodingAgentStatus.COMPLETED:
            # A completed agent that we did not attribute is otherwise invisible: the
            # webhook arrived and the agent finished, but one of the remaining gates
            # dropped it silently, leaving no SEER_DELEGATED_CURSOR row and no trace of
            # why. Log which gate blocked so these are diagnosable from logs alone.
            logger.info(
                "cursor_webhook.attribution_skipped",
                extra={
                    "agent_id": agent_id,
                    "pr_url": pr_url,
                    "repo_full_name": repo_full_name,
                    "known_to_seer": known_to_seer,
                    "has_pr_url": bool(pr_url),
                },
            )

    def _validate_pr_url(self, pr_url: str, repo_full_name: str) -> bool:
        """Validates that the URL points to the expected repo."""
        return pr_url.startswith(f"https://github.com/{repo_full_name}/pull/")
