from django.http.response import HttpResponse
from rest_framework.request import Request

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint


@control_silo_endpoint
class TempestIpsEndpoint(Endpoint):
    owner = ApiOwner.GDX
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    # Disable authentication and permission requirements.
    permission_classes = ()

    def get(self, _request: Request) -> HttpResponse:
        ips: list[str] = list(options.get("tempest.tempest-ips-api-response"))
        return HttpResponse("\n".join(ips), content_type="text/plain")
