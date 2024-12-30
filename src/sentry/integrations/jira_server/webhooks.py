from __future__ import annotations

import logging
from typing import Any

from django.core.exceptions import ObjectDoesNotExist
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.exceptions import BadRequest
from sentry.integrations.jira_server.utils import handle_assignee_change, handle_status_change
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.utils.scope import clear_tags_and_context
from sentry.integrations.webhook import IntegrationWebhookEndpoint
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import jwt, metrics

logger = logging.getLogger(__name__)


def get_integration_from_token(token: str | None) -> RpcIntegration:
    """
    When we create a jira server integration we create a webhook that contains
    a JWT in the URL. We use that JWT to locate the matching sentry integration later
    as Jira doesn't have any additional fields we can embed information in.
    """
    if not token:
        raise ValueError("Token was empty")

    try:
        unvalidated = jwt.peek_claims(token)
    except jwt.DecodeError:
        raise ValueError("Could not decode JWT token")
    if "id" not in unvalidated:
        raise ValueError("Token did not contain `id`")

    integration = integration_service.get_integration(external_id=unvalidated["id"])
    if not integration:
        raise ValueError("Could not find integration for token")
    try:
        jwt.decode(token, integration.metadata["webhook_secret"])
    except Exception as err:
        raise ValueError(f"Could not validate JWT. Got {err}")

    return integration


@region_silo_endpoint
class JiraServerIssueUpdatedWebhook(IntegrationWebhookEndpoint):
    provider = "jira_server"

    def authenticate(self, request: Request, **kwargs) -> Any:
        token = kwargs["token"]

        try:
            integration = get_integration_from_token(token)
            self.log_extra["integration_id"] = integration.id
        except ValueError as err:
            self.log_extra.update({"token": token, "error": str(err)})
            logger.warning("token-validation-error", extra=self.log_extra)
            metrics.incr("jira_server.webhook.invalid_token")
            raise BadRequest()

        return integration

    def unpack_payload(self, request: Request, **kwargs) -> Any:
        data = request.data

        # Note: If we ever process more webhooks from jira server
        # we also need to update JiraServerRequestParser
        if not data.get("changelog"):
            logger.info("missing-changelog", extra=self.log_extra)
            return None

        return data

    def post(self, request: Request, *args, **kwargs) -> Response:
        clear_tags_and_context()

        token = kwargs["token"]  # URL param
        integration = self.authenticate(request, token=token)

        data = self.unpack_payload(request)
        if data is None:
            return self.respond()

        try:
            handle_assignee_change(integration, data)
            handle_status_change(integration, data)
        except (ApiError, ObjectDoesNotExist) as err:
            self.log_extra.update({"token": token, "error": str(err)})
            logger.info("sync-failed", extra=self.log_extra)
            logger.exception("Invalid token.")
            return self.respond(status=400)
        else:
            return self.respond()
