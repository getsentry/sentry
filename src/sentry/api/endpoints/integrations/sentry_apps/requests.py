from dataclasses import dataclass
from datetime import datetime
from typing import Any, Mapping

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import RegionSentryAppBaseEndpoint, SentryAppStatsPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import RequestSerializer
from sentry.models.organization import Organization
from sentry.utils.sentry_apps import EXTENDED_VALID_EVENTS, SentryAppWebhookRequestsBuffer

INVALID_DATE_FORMAT_MESSAGE = "Invalid date format. Format must be YYYY-MM-DD HH:MM:SS."


def filter_by_date(request: Mapping[str, Any], start: float, end: float) -> bool:
    date_str = request.get("date")
    if not date_str:
        return False
    timestamp = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S.%f+00:00").replace(microsecond=0)
    return start <= timestamp <= end


def filter_by_organization(request: Mapping[str, Any], organization: Organization) -> bool:
    if not organization:
        return True
    return request["organization_id"] == organization.id


@dataclass
class BufferedRequest:
    id: int
    data: Mapping[str, Any]

    def __hash__(self):
        return self.id


@region_silo_endpoint
class SentryAppRequestsEndpoint(RegionSentryAppBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (SentryAppStatsPermission,)

    def get(self, request: Request, sentry_app) -> Response:
        """
        :qparam string eventType: Optionally specify a specific event type to filter requests
        :qparam bool errorsOnly: If this is true, only return error/warning requests (300-599)
        :qparam string organizationSlug: Optionally specify an org slug to filter requests
        :qparam string start: Optionally specify a date to begin at. Format must be YYYY-MM-DD HH:MM:SS
        :qparam string end: Optionally specify a date to end at. Format must be YYYY-MM-DD HH:MM:SS
        """
        date_format = "%Y-%m-%d %H:%M:%S"
        now = datetime.now().strftime(date_format)
        default_start = "2000-01-01 00:00:00"

        event_type = request.GET.get("eventType")
        errors_only = request.GET.get("errorsOnly")
        org_slug = request.GET.get("organizationSlug")
        start = request.GET.get("start", default_start)
        end = request.GET.get("end", now)

        try:
            start = datetime.strptime(start, date_format)
        except ValueError:
            return Response({"detail": INVALID_DATE_FORMAT_MESSAGE}, status=400)

        try:
            end = datetime.strptime(end, date_format)
        except ValueError:
            return Response({"detail": INVALID_DATE_FORMAT_MESSAGE}, status=400)

        kwargs = {}
        if event_type:
            if event_type not in EXTENDED_VALID_EVENTS:
                return Response({"detail": "Invalid event type."}, status=400)
            kwargs["event"] = event_type
        if errors_only:
            kwargs["errors_only"] = True

        buffer = SentryAppWebhookRequestsBuffer(sentry_app)
        organization = None
        if org_slug:
            try:
                organization = Organization.objects.get(slug=org_slug)
            except Organization.DoesNotExist:
                return Response({"detail": "Invalid organization."}, status=400)

        filtered_requests = []
        for i, req in enumerate(buffer.get_requests(**kwargs)):
            if filter_by_date(req, start, end) and filter_by_organization(req, organization):
                filtered_requests.append(BufferedRequest(id=i, data=req))

        return Response(serialize(filtered_requests, request.user, RequestSerializer(sentry_app)))
