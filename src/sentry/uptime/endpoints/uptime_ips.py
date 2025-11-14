from typing import int
from django.http.response import HttpResponse
from rest_framework.request import Request

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint


@region_silo_endpoint
class UptimeIpsEndpoint(Endpoint):
    owner = ApiOwner.CRONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    # Disable authentication and permission requirements.
    permission_classes = ()

    def get(self, _request: Request) -> HttpResponse:
        ips: list[str] = list(options.get("uptime.uptime-ips-api-response"))
        return HttpResponse("\n".join(ips), content_type="text/plain")
