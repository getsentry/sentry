from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.integrations.pipeline import ensure_integration

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
        state = request.data
        data = BitbucketIntegrationProvider().build_integration(state)
        ensure_integration("bitbucket", data)

        return self.respond()
