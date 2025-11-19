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
from rest_framework.exceptions import MethodNotAllowed, NotFound, ParseError, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.integrations.cursor.integration import CursorAgentIntegration
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.seer.autofix.utils import (
    AutofixState,
    CodingAgentResult,
    CodingAgentStatus,
    get_autofix_state,
    update_coding_agent_state,
)
from sentry.seer.models import SeerApiError

logger = logging.getLogger(__name__)


@region_silo_endpoint
class CursorWebhookEndpoint(Endpoint):
    owner = ApiOwner.ML_AI
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        if request.method != "POST":
            raise MethodNotAllowed(request.method or "unknown")
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request, organization_id: int) -> Response:
        organization = Organization.objects.get(id=organization_id)
        if not features.has("organizations:seer-coding-agent-integrations", organization):
            raise NotFound("Coding agent feature not enabled for this organization")

        try:
            payload = orjson.loads(request.body)
        except orjson.JSONDecodeError:
            logger.warning("cursor_webhook.invalid_json")
            raise ParseError("Invalid JSON")

        event_type = payload.get("event", payload.get("event_type", "unknown"))

        if not self._validate_signature(request, request.body, organization_id):
            logger.warning("cursor_webhook.invalid_signature")
            raise PermissionDenied("Invalid signature")

        run_id = self._get_run_id_from_request(request)

        self._process_webhook(payload, organization, run_id)
        logger.info("cursor_webhook.success", extra={"event_type": event_type})
        return self.respond(status=204)

    def _get_cursor_integration_secret(self, organization_id: int) -> str | None:
        """Get webhook secret from Cursor integration."""
        integrations = integration_service.get_integrations(
            organization_id=organization_id, providers=["cursor"]
        )

        if not integrations:
            logger.error(
                "cursor_webhook.no_integrations", extra={"organization_id": organization_id}
            )
            return None

        if len(integrations) > 1:
            logger.error(
                "cursor_webhook.multiple_integrations",
                extra={
                    "organization_id": organization_id,
                    "integration_ids": [integration.id for integration in integrations],
                },
            )
            return None

        installation = integrations[0].get_installation(organization_id)

        if not isinstance(installation, CursorAgentIntegration):
            logger.error(
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

    def _get_run_id_from_request(self, request: Request) -> int | None:
        """Extract run_id query parameter if present."""
        run_id_raw = request.query_params.get("run_id")
        if run_id_raw is None:
            return None

        try:
            run_id = int(run_id_raw)
        except (TypeError, ValueError):
            logger.warning(
                "cursor_webhook.invalid_run_id_param",
                extra={"run_id": run_id_raw},
            )
            return None

        if run_id <= 0:
            logger.warning(
                "cursor_webhook.invalid_run_id_param",
                extra={"run_id": run_id},
            )
            return None

        return run_id

    def _process_webhook(
        self, payload: dict[str, Any], organization: Organization, run_id: int | None
    ) -> None:
        """Process webhook payload based on event type."""
        event_type = payload.get("event", "unknown")

        handlers = {
            "unknown": self._handle_unknown_event,
            "statusChange": self._handle_status_change,
        }

        handler = handlers.get(event_type, self._handle_unknown_event)
        handler(payload, organization=organization, run_id=run_id)

    def _handle_unknown_event(self, payload: dict[str, Any], **_: Any) -> None:
        """Handle unknown event types."""
        logger.error("cursor_webhook.unknown_event", extra=payload)

    def _handle_status_change(
        self, payload: dict[str, Any], organization: Organization, run_id: int | None
    ) -> None:
        """Handle status change events."""
        agent_id = payload.get("id")
        cursor_status = payload.get("status")
        source = payload.get("source", {})
        target = payload.get("target", {})
        pr_url = target.get("prUrl")
        agent_url = target.get("url")
        summary = payload.get("summary")

        if not agent_id or not cursor_status:
            logger.error(
                "cursor_webhook.status_change_missing_data",
                extra={"agent_id": agent_id, "status": cursor_status},
            )
            return

        if run_id is None:
            logger.info(
                "cursor_webhook.run_id_missing",
                extra={"agent_id": agent_id},
            )
        else:
            if not self._is_agent_registered(
                agent_id=agent_id, run_id=run_id, organization=organization
            ):
                return

        status = CodingAgentStatus.from_cursor_status(cursor_status)
        if not status:
            logger.error(
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
            logger.error(
                "cursor_webhook.repo_not_found",
                extra={"agent_id": agent_id, "source": source},
            )
            return

        # Ensure the repo URL has a protocol, on their docs it says it should but we found it doesn't?
        if not repo_url.startswith("https://"):
            repo_url = f"https://{repo_url}"

        parsed = urlparse(repo_url)
        if parsed.netloc != "github.com":
            logger.error(
                "cursor_webhook.not_github_repo",
                extra={"agent_id": agent_id, "repo": repo_url},
            )
            return

        repo_provider = "github"
        repo_full_name = parsed.path.lstrip("/")

        # If the repo isn't in the owner/repo format we can't work with it
        # Allow dots in the repository name segment (owner.repo is common)
        if not re.match(r"^[a-zA-Z0-9_-]+/[a-zA-Z0-9_.-]+$", repo_full_name):
            logger.error(
                "cursor_webhook.repo_format_invalid",
                extra={"agent_id": agent_id, "source": source},
            )
            return

        result = CodingAgentResult(
            repo_full_name=repo_full_name,
            repo_provider=repo_provider,
            description=summary or f"Agent {status.lower()}",
            pr_url=pr_url if status == CodingAgentStatus.COMPLETED else None,
        )

        self._update_coding_agent_status(
            agent_id=agent_id,
            status=status,
            agent_url=agent_url,
            result=result,
            run_id=run_id,
        )

    def _fetch_autofix_state(
        self, *, organization: Organization, run_id: int
    ) -> AutofixState | None:
        try:
            return get_autofix_state(run_id=run_id, organization_id=organization.id)
        except Exception:
            logger.exception(
                "cursor_webhook.autofix_state_fetch_failed",
                extra={"organization_id": organization.id, "run_id": run_id},
            )
            return None

    def _is_agent_registered(
        self, *, agent_id: str, run_id: int, organization: Organization
    ) -> bool:
        state = self._fetch_autofix_state(organization=organization, run_id=run_id)
        if state is None:
            logger.warning(
                "cursor_webhook.autofix_state_unavailable",
                extra={"organization_id": organization.id, "run_id": run_id},
            )
            return False

        coding_agents = state.coding_agents or {}
        if agent_id not in coding_agents:
            logger.warning(
                "cursor_webhook.agent_not_registered_for_run",
                extra={
                    "organization_id": organization.id,
                    "run_id": run_id,
                    "agent_id": agent_id,
                },
            )
            return False

        return True

    def _update_coding_agent_status(
        self,
        agent_id: str,
        status: CodingAgentStatus,
        agent_url: str | None = None,
        result: CodingAgentResult | None = None,
        run_id: int | None = None,
    ):
        try:
            update_coding_agent_state(
                agent_id=agent_id,
                status=status,
                agent_url=agent_url,
                result=result,
            )
            logger.info(
                "cursor_webhook.status_updated_to_seer",
                extra={
                    "agent_id": agent_id,
                    "status": status.value,
                    "has_result": result is not None,
                    "run_id": run_id,
                },
            )
        except SeerApiError as exc:
            if self._is_missing_run_error(exc):
                logger.info(
                    "cursor_webhook.agent_not_found_in_seer",
                    extra={
                        "agent_id": agent_id,
                        "status": status.value,
                        "run_id": run_id,
                    },
                )
                return

            logger.exception(
                "cursor_webhook.seer_update_error",
                extra={
                    "agent_id": agent_id,
                    "status": status.value,
                    "run_id": run_id,
                },
            )

    def _is_missing_run_error(self, error: SeerApiError) -> bool:
        try:
            payload = orjson.loads(error.message)
        except orjson.JSONDecodeError:
            return False

        detail = payload.get("detail")
        return isinstance(detail, str) and "No run_id found" in detail
