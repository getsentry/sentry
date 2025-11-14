from typing import int
import sentry_sdk
from django.db import router, transaction
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.jira.integration import JiraIntegrationProvider
from sentry.integrations.jira.tasks import sync_metadata
from sentry.integrations.jira.webhooks.base import JiraWebhookBase
from sentry.integrations.pipeline import ensure_integration
from sentry.integrations.project_management.metrics import ProjectManagementFailuresReason
from sentry.integrations.utils.atlassian_connect import authenticate_asymmetric_jwt, verify_claims
from sentry.integrations.utils.metrics import (
    IntegrationPipelineViewEvent,
    IntegrationPipelineViewType,
)
from sentry.utils import jwt

# Atlassian sends scanner bots to "test" Atlassian apps and they often hit this endpoint with a bad kid causing errors
INVALID_KEY_IDS = ["fake-kid"]


@control_silo_endpoint
class JiraSentryInstalledWebhook(JiraWebhookBase):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    """
    Webhook hit by Jira whenever someone installs the Sentry integration in their Jira instance.
    """

    def post(self, request: Request, *args, **kwargs) -> Response:
        with IntegrationPipelineViewEvent(
            interaction_type=IntegrationPipelineViewType.VERIFY_INSTALLATION,
            domain=IntegrationDomain.PROJECT_MANAGEMENT,
            provider_key=self.provider,
        ).capture() as lifecycle:
            token = self.get_token(request)
            state = request.data
            if not state:
                lifecycle.record_failure(ProjectManagementFailuresReason.INSTALLATION_STATE_MISSING)
                return self.respond(status=status.HTTP_400_BAD_REQUEST)

            key_id = jwt.peek_header(token).get("kid")
            lifecycle.add_extras(
                {
                    "key_id": key_id,
                    "base_url": state.get("baseUrl", ""),
                    "description": state.get("description", ""),
                    "clientKey": state.get("clientKey", ""),
                }
            )

            if key_id:
                if key_id in INVALID_KEY_IDS:
                    lifecycle.record_halt(halt_reason="JWT contained invalid key_id (kid)")
                    return self.respond(
                        {"detail": "Invalid key id"}, status=status.HTTP_400_BAD_REQUEST
                    )
                decoded_claims = authenticate_asymmetric_jwt(token, key_id)
                verify_claims(decoded_claims, request.path, request.GET, method="POST")

            data = JiraIntegrationProvider().build_integration(state)
            integration = ensure_integration(self.provider, data)

            # Note: Unlike in all other Jira webhooks, we don't call `bind_org_context_from_integration`
            # here, because at this point the integration hasn't yet been bound to an organization. The
            # best we can do at this point is to record the integration's id.
            sentry_sdk.set_tag("integration_id", integration.id)

            # Sync integration metadata from Jira. This must be executed *after*
            # the integration has been installed on Jira as the access tokens will
            # not work until then.
            transaction.on_commit(
                lambda: sync_metadata.delay(integration_id=integration.id),
                using=router.db_for_write(integration.__class__),
            )

            return self.respond()
