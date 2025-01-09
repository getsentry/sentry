from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.repository import repository_service
from sentry.integrations.utils.atlassian_connect import (
    AtlassianConnectValidationError,
    get_integration_from_jwt,
)


@control_silo_endpoint
class BitbucketUninstalledEndpoint(Endpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request: Request, *args, **kwargs) -> Response:
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request, *args, **kwargs) -> Response:
        try:
            token = request.META["HTTP_AUTHORIZATION"].split(" ", 1)[1]
        except (KeyError, IndexError):
            return self.respond(status=400)

        try:
            rpc_integration = get_integration_from_jwt(
                token, request.path, "bitbucket", request.GET, method="POST"
            )
        except AtlassianConnectValidationError:
            return self.respond(status=400)

        integration = Integration.objects.get(id=rpc_integration.id)
        integration.update(status=ObjectStatus.DISABLED)
        org_integrations = integration_service.get_organization_integrations(
            integration_id=integration.id
        )

        for oi in org_integrations:
            repository_service.disable_repositories_for_integration(
                organization_id=oi.organization_id,
                integration_id=integration.id,
                provider="integrations:bitbucket",
            )

        return self.respond()
