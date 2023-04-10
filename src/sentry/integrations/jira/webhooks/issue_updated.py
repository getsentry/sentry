from __future__ import annotations

import logging
from typing import Any, Mapping

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import pending_silo_endpoint
from sentry.integrations.utils import get_integration_from_jwt
from sentry.shared_integrations.exceptions import ApiError

from ..utils import handle_assignee_change, handle_jira_api_error, handle_status_change
from .base import JiraEndpointBase

logger = logging.getLogger(__name__)


@pending_silo_endpoint
class JiraIssueUpdatedWebhook(JiraEndpointBase):
    def handle_exception(
        self, request: Request, exc: Exception, handler_context: Mapping[str, Any] | None = None
    ) -> Response:
        if isinstance(exc, ApiError):
            response_option = handle_jira_api_error(exc, " to get email")
            if response_option:
                return self.respond(response_option)

        return super().handle_exception(request, exc, handler_context)

    def post(self, request: Request, *args, **kwargs) -> Response:
        token = self.get_token(request)
        integration = get_integration_from_jwt(
            token=token,
            path=request.path,
            provider=self.provider,
            query_params=request.GET,
            method="POST",
        )

        data = request.data
        if not data.get("changelog"):
            logger.info("missing-changelog", extra={"integration_id": integration.id})
            return self.respond()

        handle_assignee_change(integration, data, use_email_scope=settings.JIRA_USE_EMAIL_SCOPE)
        handle_status_change(integration, data)

        return self.respond()
