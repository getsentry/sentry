from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.pipeline import ensure_integration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.atlassian_connect import (
    AtlassianConnectTokenValidator,
    AtlassianConnectValidationError,
)
from sentry.integrations.utils.metrics import (
    IntegrationPipelineViewEvent,
    IntegrationPipelineViewType,
)

from .integration import BitbucketIntegrationProvider


@control_silo_endpoint
class BitbucketInstalledEndpoint(Endpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponseBase:
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request, *args, **kwargs) -> Response:
        with IntegrationPipelineViewEvent(
            interaction_type=IntegrationPipelineViewType.VERIFY_INSTALLATION,
            domain=IntegrationDomain.SOURCE_CODE_MANAGEMENT,
            provider_key=IntegrationProviderSlug.BITBUCKET.value,
        ).capture() as lifecycle:
            state = request.data

            try:
                AtlassianConnectTokenValidator(request, method="POST").get_token()
            except AtlassianConnectValidationError as e:
                lifecycle.record_halt(halt_reason=str(e))
                return self.respond(
                    {"detail": "Request Token Validation Failed"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            data = BitbucketIntegrationProvider().build_integration(state)
            ensure_integration(IntegrationProviderSlug.BITBUCKET.value, data)

            return self.respond()
