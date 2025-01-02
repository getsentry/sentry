from typing import Any

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.integrations.jira.tasks import sync_metadata
from sentry.integrations.pipeline import ensure_integration
from sentry.integrations.utils.atlassian_connect import authenticate_asymmetric_jwt, verify_claims
from sentry.utils import jwt

from ...base import IntegrationDomain
from ...project_management.metrics import ProjectManagementFailuresReason
from ...utils.metrics import IntegrationPipelineViewEvent, IntegrationPipelineViewType
from ..integration import JiraIntegrationProvider
from .base import JiraWebhookBase


@control_silo_endpoint
class JiraSentryInstalledWebhook(JiraWebhookBase[None, dict[str, Any] | None]):
    """
    Webhook hit by Jira whenever someone installs the Sentry integration in their Jira instance.
    """

    def authenticate(self, request: Request, **kwargs) -> None:
        token = self.get_token(request)

        key_id = jwt.peek_header(token).get("kid")
        if key_id:
            decoded_claims = authenticate_asymmetric_jwt(token, key_id)
            verify_claims(decoded_claims, request.path, request.GET, method="POST")

    def unpack_payload(self, request: Request, **kwargs) -> dict[str, Any] | None:
        state = request.data
        if not state:
            kwargs["lifecycle"].record_failure(
                ProjectManagementFailuresReason.INSTALLATION_STATE_MISSING
            )
            return None

        return state

    def post(self, request: Request, *args, **kwargs) -> Response:
        with IntegrationPipelineViewEvent(
            interaction_type=IntegrationPipelineViewType.VERIFY_INSTALLATION,
            domain=IntegrationDomain.PROJECT_MANAGEMENT,
            provider_key=self.provider,
        ).capture() as lifecycle:
            self.authenticate(request)
            state = self.unpack_payload(request, lifecycle=lifecycle)
            if state is None:
                return self.respond(status=400)

            data = JiraIntegrationProvider().build_integration(state)
            integration = ensure_integration(self.provider, data)

            # Note: Unlike in all other Jira webhooks, we don't call `bind_org_context_from_integration`
            # here, because at this point the integration hasn't yet been bound to an organization. The
            # best we can do at this point is to record the integration's id.
            sentry_sdk.set_tag("integration_id", integration.id)

            # Sync integration metadata from Jira. This must be executed *after*
            # the integration has been installed on Jira as the access tokens will
            # not work until then.
            sync_metadata.apply_async(kwargs={"integration_id": integration.id}, countdown=10)

            return self.respond()
