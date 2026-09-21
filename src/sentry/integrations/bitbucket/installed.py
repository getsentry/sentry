from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.integrations.models.integration import Integration
from sentry.integrations.pipeline import ensure_integration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.atlassian_connect import (
    AtlassianConnectValidationError,
    get_integration_from_jwt,
    get_token,
)
from sentry.shared_integrations.exceptions import ApiError

from .client import BitbucketApiClient
from .integration import BitbucketIntegrationProvider


@control_silo_endpoint
class BitbucketInstalledEndpoint(Endpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponseBase:
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request, *args, **kwargs) -> Response:
        state = request.data
        if not state:
            return self.respond(status=400)

        client_key = state.get("clientKey")
        if not client_key:
            return self.respond(status=400)

        existing = Integration.objects.filter(
            provider=IntegrationProviderSlug.BITBUCKET.value,
            external_id=client_key,
        ).first()

        if existing:
            try:
                token = get_token(request)
                rpc_integration = get_integration_from_jwt(
                    token=token,
                    path=request.path,
                    provider=IntegrationProviderSlug.BITBUCKET.value,
                    query_params=request.GET,
                    method="POST",
                )
            except AtlassianConnectValidationError:
                return self.respond(status=401)

            if rpc_integration.external_id != client_key:
                return self.respond(status=403)

        data = BitbucketIntegrationProvider().build_integration(state)
        if not existing:
            pending_integration = Integration(
                provider=IntegrationProviderSlug.BITBUCKET.value,
                external_id=client_key,
                name=data.get("name", client_key),
                metadata=data.get("metadata", {}),
            )
            try:
                BitbucketApiClient(pending_integration).get_workspace_hooks(
                    state["principal"]["uuid"]
                )
            except ApiError as error:
                if error.code is not None and 400 <= error.code < 500 and error.code != 429:
                    return self.respond(status=401)
                raise

        ensure_integration(
            IntegrationProviderSlug.BITBUCKET.value,
            data,
            overwrite_existing_integration=bool(existing),
        )

        return self.respond()
