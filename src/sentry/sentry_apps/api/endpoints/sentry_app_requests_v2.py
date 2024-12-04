from dataclasses import dataclass
from datetime import datetime

from dateutil.parser import parse as parse_date
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.organizations.services.organization import RpcOrganizationSummary, organization_service
from sentry.sentry_apps.api.bases.sentryapps import SentryAppBaseEndpoint, SentryAppStatsPermission
from sentry.sentry_apps.api.serializers.request_v2 import RequestSerializer
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.services.app_request import RpcSentryAppRequest, SentryAppRequestFilterArgs
from sentry.sentry_apps.services.app_request.serial import serialize_rpc_sentry_app_request
from sentry.sentry_apps.services.app_request.service import app_request_service
from sentry.types.region import find_all_region_names
from sentry.utils.sentry_apps import EXTENDED_VALID_EVENTS, SentryAppWebhookRequestsBuffer

INVALID_DATE_FORMAT_MESSAGE = "Invalid date format. Format must be YYYY-MM-DD HH:MM:SS."


def filter_by_date(request: RpcSentryAppRequest, start: datetime, end: datetime) -> bool:
    date_str = request.date
    if not date_str:
        return False
    timestamp = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S.%f+00:00").replace(microsecond=0)
    return start <= timestamp <= end


def filter_by_organization(
    request: RpcSentryAppRequest, organization: RpcOrganizationSummary | None
) -> bool:
    if not organization:
        return True
    return request.organization_id == organization.id


@dataclass
class BufferedRequest:
    id: int
    data: RpcSentryAppRequest

    def __hash__(self):
        return self.id


@control_silo_endpoint
class SentryAppRequestsEndpointV2(SentryAppBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (SentryAppStatsPermission,)

    def get(self, request: Request, sentry_app: SentryApp) -> Response:
        """
        :qparam string eventType: Optionally specify a specific event type to filter requests
        :qparam bool errorsOnly: If this is true, only return error/warning requests (300-599)
        :qparam string organizationSlug: Optionally specify an org slug to filter requests
        :qparam string start: Optionally specify a date to begin at. Format must be YYYY-MM-DD HH:MM:SS
        :qparam string end: Optionally specify a date to end at. Format must be YYYY-MM-DD HH:MM:SS
        """
        date_format = "%Y-%m-%d %H:%M:%S"
        start_time: datetime = datetime.strptime("2000-01-01 00:00:00", date_format)
        end_time: datetime = datetime.now()

        event_type = request.GET.get("eventType")
        errors_only = request.GET.get("errorsOnly")
        org_slug = request.GET.get("organizationSlug")
        start_parameter = request.GET.get("start", None)
        end_parameter = request.GET.get("end", None)

        try:
            start_time = (
                datetime.strptime(start_parameter, date_format) if start_parameter else start_time
            )
        except ValueError:
            return Response({"detail": INVALID_DATE_FORMAT_MESSAGE}, status=400)

        try:

            end_time = datetime.strptime(end_parameter, date_format) if end_parameter else end_time
        except ValueError:
            return Response({"detail": INVALID_DATE_FORMAT_MESSAGE}, status=400)

        filter: SentryAppRequestFilterArgs = {}
        if event_type:
            if event_type not in EXTENDED_VALID_EVENTS:
                return Response({"detail": "Invalid event type."}, status=400)
            filter["event"] = event_type
        else:
            filter["event"] = list(
                set(EXTENDED_VALID_EVENTS)
                - {
                    "installation.created",
                    "installation.deleted",
                }
            )
        if errors_only:
            filter["errors_only"] = True

        organization = None
        if org_slug:
            organization = organization_service.get_org_by_slug(slug=org_slug)
            if organization is None:
                return Response({"detail": "Invalid organization."}, status=400)

        requests: list[RpcSentryAppRequest] = []

        buffer = SentryAppWebhookRequestsBuffer(sentry_app)
        control_errors_only = True if errors_only else False

        if event_type == "installation.created" or event_type == "installation.deleted":

            requests.extend(
                [
                    serialize_rpc_sentry_app_request(req)
                    for req in buffer.get_requests(
                        event=event_type, errors_only=control_errors_only
                    )
                ]
            )
        elif event_type is None:
            control_event_type = [
                "installation.created",
                "installation.deleted",
            ]
            requests.extend(
                [
                    serialize_rpc_sentry_app_request(req)
                    for req in buffer.get_requests(
                        event=control_event_type, errors_only=control_errors_only
                    )
                ]
            )

        # If event type is installation.created or installation.deleted, we don't need to fetch requests from other regions
        if event_type != "installation.created" and event_type != "installation.deleted":
            for region_name in find_all_region_names():
                buffer_requests = app_request_service.get_buffer_requests_for_region(
                    sentry_app_id=sentry_app.id,
                    region_name=region_name,
                    filter=filter,
                )
                if buffer_requests is not None:
                    requests.extend(buffer_requests)

        requests.sort(key=lambda x: parse_date(x.date), reverse=True)
        filtered_requests: list[BufferedRequest] = []
        for i, req in enumerate(requests):
            if filter_by_date(req, start_time, end_time) and filter_by_organization(
                req, organization
            ):
                filtered_requests.append(BufferedRequest(id=i, data=req))

        def data_fn(offset, limit):
            page_offset = offset * limit
            return filtered_requests[page_offset : page_offset + limit]

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn),
            on_results=lambda x: serialize(x, request.user, RequestSerializer(sentry_app)),
        )
