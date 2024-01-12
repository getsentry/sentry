import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.constants import ObjectStatus
from sentry.integrations.utils import get_integration_from_jwt
from sentry.integrations.utils.scope import bind_org_context_from_integration
from sentry.models.integrations.integration import Integration

from .base import JiraWebhookBase


@control_silo_endpoint
class JiraSentryUninstalledWebhook(JiraWebhookBase):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.UNKNOWN,
    }
    """
    Webhook hit by Jira whenever someone uninstalls the Sentry integration from their Jira instance.
    """

    def post(self, request: Request, *args, **kwargs) -> Response:
        token = self.get_token(request)
        rpc_integration = get_integration_from_jwt(
            token=token,
            path=request.path,
            provider=self.provider,
            query_params=request.GET,
            method="POST",
        )
        integration = Integration.objects.get(id=rpc_integration.id)
        bind_org_context_from_integration(integration.id, {"webhook": "uninstalled"})
        sentry_sdk.set_tag("integration_id", integration.id)

        integration.update(status=ObjectStatus.DISABLED)

        return self.respond()
