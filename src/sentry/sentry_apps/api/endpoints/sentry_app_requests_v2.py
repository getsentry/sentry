from dataclasses import dataclass
from datetime import datetime, timezone

from dateutil.parser import parse as parse_date
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.organizationmapping import OrganizationMapping
from sentry.sentry_apps.api.bases.sentryapps import SentryAppBaseEndpoint, SentryAppStatsPermission
from sentry.sentry_apps.api.serializers.request_v2 import RequestSerializer
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.services.app_request import RpcSentryAppRequest, SentryAppRequestFilterArgs
from sentry.sentry_apps.services.app_request.serial import serialize_rpc_sentry_app_request
from sentry.sentry_apps.services.app_request.service import app_request_service
from sentry.types.region import find_all_region_names
from sentry.utils.sentry_apps import EXTENDED_VALID_EVENTS, SentryAppWebhookRequestsBuffer


class IncomingRequestSerializer(serializers.Serializer):
    date_format = "%Y-%m-%d %H:%M:%S"
    eventType = serializers.ChoiceField(
        choices=EXTENDED_VALID_EVENTS,
        required=False,
    )
    errorsOnly = serializers.BooleanField(required=False)
    organizationSlug = serializers.CharField(required=False)
    start = serializers.DateTimeField(
        format=date_format,
        default=datetime.strptime("2000-01-01 00:00:00", date_format).replace(tzinfo=timezone.utc),
        default_timezone=timezone.utc,
        required=False,
    )
    end = serializers.DateTimeField(
        format=date_format, default=None, default_timezone=timezone.utc, required=False
    )

    def validate(self, data):
        if "start" in data and "end" in data and data["start"] > data["end"]:
            raise serializers.ValidationError("Invalid timestamp (start must be before end).")
        return data

    def validate_end(self, end):
        if end is None:
            end = datetime.now(tz=timezone.utc)
        return end


def filter_by_date(request: RpcSentryAppRequest, start: datetime, end: datetime) -> bool:
    date_str = request.date
    if not date_str:
        return False
    timestamp = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S.%f+00:00").replace(
        microsecond=0, tzinfo=timezone.utc
    )
    return start <= timestamp <= end


def filter_by_organization(
    request: RpcSentryAppRequest, organization: OrganizationMapping | None
) -> bool:
    if not organization:
        return True
    return request.organization_id == organization.organization_id


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
        "GET": ApiPublishStatus.EXPERIMENTAL,
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
        serializer = IncomingRequestSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serialized = serializer.validated_data

        event_type = serialized.get("eventType")
        errors_only = serialized.get("errorsOnly")
        org_slug = serialized.get("organizationSlug")
        start_time = serialized.get("start")
        end_time = serialized.get("end")

        organization = None
        if org_slug:
            try:
                organization = OrganizationMapping.objects.get(slug=org_slug)
            except OrganizationMapping.DoesNotExist:
                return Response({"detail": "Invalid organization."}, status=400)

        requests: list[RpcSentryAppRequest] = []
        region_filter: SentryAppRequestFilterArgs = {}
        control_buffer = SentryAppWebhookRequestsBuffer(sentry_app)
        control_errors_only = region_filter["errors_only"] = errors_only

        def get_buffer_requests_for_control(event_type) -> list[RpcSentryAppRequest]:
            control_buffer.get_requests(event=event_type, errors_only=control_errors_only)
            requests.extend(
                [
                    serialize_rpc_sentry_app_request(req)
                    for req in control_buffer.get_requests(
                        event=event_type, errors_only=control_errors_only
                    )
                ]
            )

        def get_buffer_requests_for_regions() -> list[RpcSentryAppRequest]:
            for region_name in find_all_region_names():
                buffer_requests = app_request_service.get_buffer_requests_for_region(
                    sentry_app_id=sentry_app.id,
                    region_name=region_name,
                    filter=region_filter,
                )
                if buffer_requests is not None:
                    requests.extend(buffer_requests)

        # If event type is installation.created or installation.deleted, we only need to fetch requests from the control buffer
        if event_type == "installation.created" or event_type == "installation.deleted":
            get_buffer_requests_for_control(event_type)
        # If event type has been specified, we only need to fetch requests from region buffers
        elif event_type:
            region_filter["event"] = event_type
            get_buffer_requests_for_regions()
        else:
            control_event_type = [
                "installation.created",
                "installation.deleted",
            ]
            get_buffer_requests_for_control(control_event_type)
            region_filter["event"] = list(
                set(EXTENDED_VALID_EVENTS)
                - {
                    "installation.created",
                    "installation.deleted",
                }
            )
            get_buffer_requests_for_regions()

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
