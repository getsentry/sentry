from django.http.response import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework.request import Request

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint


# TODO(cells): This endpoint is moving to control
@all_silo_endpoint
@extend_schema(tags=["Crons"])
class UptimeIpsEndpoint(Endpoint):
    owner = ApiOwner.CRONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    # Disable authentication and permission requirements.
    permission_classes = ()

    @extend_schema(
        operation_id="listUptimeCheckerIps",
        summary="List Uptime Checker IP Addresses",
        auth=[],
        parameters=[],
        request=None,
        responses={
            (200, "text/plain"): OpenApiResponse(
                response=OpenApiTypes.STR,
                description="The IP addresses, one per line.",
                examples=[
                    OpenApiExample(
                        "Uptime checker IP addresses",
                        value="192.0.2.10\n198.51.100.20\n203.0.113.30",
                    )
                ],
            ),
        },
    )
    def get(self, _request: Request) -> HttpResponse:
        """
        Return the IP addresses that uptime checks are sent from, as plain text with one
        address per line. Allow these addresses through your firewall so uptime checks can
        reach your site. This endpoint doesn't require authentication.
        """
        ips: list[str] = list(options.get("uptime.uptime-ips-api-response"))
        return HttpResponse("\n".join(ips), content_type="text/plain")
