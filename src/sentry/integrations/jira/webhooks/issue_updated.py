from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import Scope

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.integrations.utils.atlassian_connect import get_integration_from_jwt
from sentry.integrations.utils.scope import bind_org_context_from_integration
from sentry.ratelimits.config import RateLimitConfig
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.ratelimit import RateLimit, RateLimitCategory

from ..utils import handle_assignee_change, handle_jira_api_error, handle_status_change
from .base import JiraWebhookBase

logger = logging.getLogger(__name__)

PAYLOAD_LOGGING_FEATURE = "organizations:jira-issue-updated-payload-logging"


@cell_silo_endpoint
class JiraIssueUpdatedWebhook(JiraWebhookBase):
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
    Webhook hit by Jira whenever an issue is updated in Jira's database.
    """

    def handle_exception_with_details(
        self,
        request: Request,
        exc: Exception,
        handler_context: Mapping[str, Any] | None = None,
        scope: Scope | None = None,
    ) -> Response:
        if isinstance(exc, ApiError):
            response_option = handle_jira_api_error(exc, " to get email")
            if response_option:
                return self.respond(response_option)

        return super().handle_exception_with_details(request, exc, handler_context, scope)

    def post(self, request: Request, *args, **kwargs) -> Response:
        token = self.get_token(request)
        rpc_integration = get_integration_from_jwt(
            token=token,
            path=request.path,
            provider=self.provider,
            query_params=request.GET,
            method="POST",
        )
        # Integrations and their corresponding RpcIntegrations share the same id,
        # so we don't need to first convert this to a full Integration object.
        # Capture the bound org so the payload-logging feature check below can
        # reuse it instead of re-resolving the integration.
        org = bind_org_context_from_integration(rpc_integration.id, {"webhook": "issue_updated"})
        sentry_sdk.set_tag("integration_id", rpc_integration.id)

        data = request.data

        # Temporary: when the linked org has the
        # `jira-issue-updated-payload-logging` feature enabled, log the full
        # webhook payload so we can see exactly what Jira sends us (especially
        # for `project` changes, which we want to use to update the linked
        # Jira issue link in Sentry). Skip the check (and the log) for ambiguous
        # multi-tenant Jira installations, where `org is None`.
        #
        # This is purely diagnostic, so swallow any failure (including transient
        # RPC errors from the feature-flag check) rather than letting it skip
        # the real `handle_assignee_change` / `handle_status_change` calls below.
        try:
            if org is not None and features.has(PAYLOAD_LOGGING_FEATURE, org):
                issue = data.get("issue") or {}
                fields = issue.get("fields") or {}
                changelog_items = (data.get("changelog") or {}).get("items") or []
                payload_extra = {
                    "integration_id": rpc_integration.id,
                    "issue_key": issue.get("key"),
                    "issue_id": issue.get("id"),
                    "webhook_event": data.get("webhookEvent"),
                    "changed_fields": [item.get("field") for item in changelog_items],
                    "project": fields.get("project"),
                    "payload": data,
                }
                logger.info("jira.issue-updated.payload", extra=payload_extra)
                project_change = next(
                    (item for item in changelog_items if item.get("field") == "project"),
                    None,
                )
                if project_change is not None:
                    logger.info(
                        "jira.issue-updated.project-changed",
                        extra={**payload_extra, "project_change": project_change},
                    )
        except Exception as e:
            sentry_sdk.capture_exception(e)

        if not data.get("changelog"):
            logger.info("jira.missing-changelog", extra={"integration_id": rpc_integration.id})
            return self.respond()

        handle_assignee_change(rpc_integration, data, use_email_scope=settings.JIRA_USE_EMAIL_SCOPE)
        handle_status_change(rpc_integration, data)

        return self.respond()
