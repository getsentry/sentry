from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import sentry_sdk
from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import Scope

from sentry.api.base import region_silo_endpoint
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.utils.atlassian_connect import get_integration_from_jwt
from sentry.integrations.utils.scope import bind_org_context_from_integration
from sentry.shared_integrations.exceptions import ApiError

from ..utils import handle_assignee_change, handle_jira_api_error, handle_status_change
from .base import JiraWebhookBase

logger = logging.getLogger(__name__)


@region_silo_endpoint
class JiraIssueUpdatedWebhook(JiraWebhookBase):
    """
    Webhook hit by Jira whenever an issue is updated in Jira's database.
    """

    def authenticate(self, request: Request, **kwargs) -> Any:
        token = self.get_token(request)
        rpc_integration = get_integration_from_jwt(
            token=token,
            path=request.path,
            provider=self.provider,
            query_params=request.GET,
            method="POST",
        )
        return rpc_integration

    def unpack_payload(self, request: Request, **kwargs) -> Any:
        data = request.data
        if not data.get("changelog"):
            self.log_extra["integration_id"] = kwargs["rpc_integration"].id
            logger.info("jira.missing-changelog", extra=self.log_extra)
            return None

        return data

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
        rpc_integration = self.authenticate(request)
        assert isinstance(rpc_integration, RpcIntegration)

        data = self.unpack_payload(request, rpc_integration=rpc_integration)
        if data is None:
            return self.respond()

        # Integrations and their corresponding RpcIntegrations share the same id,
        # so we don't need to first convert this to a full Integration object
        bind_org_context_from_integration(rpc_integration.id, {"webhook": "issue_updated"})
        sentry_sdk.set_tag("integration_id", rpc_integration.id)

        handle_assignee_change(rpc_integration, data, use_email_scope=settings.JIRA_USE_EMAIL_SCOPE)
        handle_status_change(rpc_integration, data)

        return self.respond()
