from django.http.response import HttpResponse
from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint

UPTIME_IP_ADDRESSES = [
    "34.123.33.225",
    "34.41.121.171",
    "34.169.179.115",
    "35.237.134.233",
    "34.85.249.57",
    "34.159.197.47",
    "35.242.231.10",
    "34.107.93.3",
    "35.204.169.245",
]


@region_silo_endpoint
class UptimeIpsEndpoint(Endpoint):
    owner = ApiOwner.CRONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    # Disable authentication and permission requirements.
    permission_classes = ()

    def get(self, _request: Request) -> HttpResponse:
        return HttpResponse("\n".join(UPTIME_IP_ADDRESSES), content_type="text/plain")
