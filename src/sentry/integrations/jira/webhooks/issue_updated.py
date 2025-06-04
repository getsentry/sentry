from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import Scope

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.integrations.utils.atlassian_connect import get_integration_from_jwt
from sentry.integrations.utils.scope import bind_org_context_from_integration
from sentry.shared_integrations.exceptions import ApiError

from ..utils import handle_assignee_change, handle_jira_api_error, handle_status_change
from .base import JiraWebhookBase

logger = logging.getLogger(__name__)


@region_silo_endpoint
class JiraIssueUpdatedWebhook(JiraWebhookBase):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
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
        if not data.get("changelog"):
            logger.info("jira.missing-changelog", extra={"integration_id": rpc_integration.id})
            return self.respond()

        handle_assignee_change(rpc_integration, data, use_email_scope=settings.JIRA_USE_EMAIL_SCOPE)
        handle_status_change(rpc_integration, data)

        return self.respond()
