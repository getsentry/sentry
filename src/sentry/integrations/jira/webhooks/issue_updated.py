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
from sentry.integrations.services.integration import integration_service
from sentry.integrations.utils.atlassian_connect import get_integration_from_jwt
from sentry.integrations.utils.scope import bind_org_context_from_integration
from sentry.organizations.services.organization import organization_service
from sentry.ratelimits.config import RateLimitConfig
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.ratelimit import RateLimit, RateLimitCategory

from ..utils import handle_assignee_change, handle_jira_api_error, handle_status_change
from .base import JiraWebhookBase

logger = logging.getLogger(__name__)

PAYLOAD_LOGGING_FEATURE = "organizations:jira-issue-updated-payload-logging"


def _payload_logging_enabled(integration_id: int) -> bool:
    """True if any org linked to this Jira integration has the
    `jira-issue-updated-payload-logging` feature enabled.

    A Jira integration can be shared by multiple Sentry orgs, and
    `features.has` needs an `Organization`, so we have to walk the linked
    `OrganizationIntegration` rows and look each org up.
    """
    contexts = integration_service.organization_contexts(integration_id=integration_id)
    for oi in contexts.organization_integrations:
        org = organization_service.get_organization_by_id(
            id=oi.organization_id, include_teams=False, include_projects=False
        )
        if org and features.has(PAYLOAD_LOGGING_FEATURE, org.organization):
            return True
    return False


@cell_silo_endpoint
class JiraIssueUpdatedWebhook(JiraWebhookBase):
    owner = ApiOwner.INTEGRATIONS
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
        # so we don't need to first convert this to a full Integration object
        bind_org_context_from_integration(rpc_integration.id, {"webhook": "issue_updated"})
        sentry_sdk.set_tag("integration_id", rpc_integration.id)

        data = request.data

        # Temporary: when a linked org has the
        # `jira-issue-updated-payload-logging` feature enabled, log the full
        # webhook payload so we can see exactly what Jira sends us (especially
        # for `project` changes, which we want to use to update the linked
        # Jira issue link in Sentry).
        #
        # This is purely diagnostic, so swallow any failure (including transient
        # RPC errors from the feature-flag check) rather than letting it skip
        # the real `handle_assignee_change` / `handle_status_change` calls below.
        try:
            if _payload_logging_enabled(rpc_integration.id):
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
        except Exception:
            logger.exception(
                "jira.issue-updated.payload-logging-failed",
                extra={"integration_id": rpc_integration.id},
            )

        if not data.get("changelog"):
            logger.info("jira.missing-changelog", extra={"integration_id": rpc_integration.id})
            return self.respond()

        handle_assignee_change(rpc_integration, data, use_email_scope=settings.JIRA_USE_EMAIL_SCOPE)
        handle_status_change(rpc_integration, data)

        return self.respond()
