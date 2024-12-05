from dataclasses import dataclass
from datetime import datetime

from collections.abc import Mapping
from typing import Any

from dateutil.parser import parse as parse_date
from responses import start
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.organizations.services.organization import RpcOrganizationSummary, organization_service
from sentry.sentry_apps.api.bases.sentryapps import SentryAppBaseEndpoint, SentryAppStatsPermission
from sentry.sentry_apps.api.serializers.request_v2 import RequestSerializer
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.services.app_request import RpcSentryAppRequest, SentryAppRequestFilterArgs
from sentry.sentry_apps.services.app_request.serial import serialize_rpc_sentry_app_request
from sentry.sentry_apps.services.app_request.service import app_request_service
from sentry.types.region import find_all_region_names
from sentry.utils.sentry_apps import EXTENDED_VALID_EVENTS, SentryAppWebhookRequestsBuffer
from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer

INVALID_DATE_FORMAT_MESSAGE = "Invalid date format. Format must be YYYY-MM-DD HH:MM:SS."


class IncomingRequestSerializer(CamelSnakeSerializer, serializers.Serializer):
    date_format = "%Y-%m-%d %H:%M:%S"
    event_type = serializers.ChoiceField(
        choices=EXTENDED_VALID_EVENTS,
        required=False,
    )
    errors_only = serializers.BooleanField(required=False)
    organization_slug = serializers.CharField(required=False)
    start = serializers.DateTimeField(
        format=date_format,
        default=datetime.strptime("2000-01-01 00:00:00", date_format),
        required=False,
    )
    end = serializers.DateTimeField(format=date_format, default=datetime.now(), required=False)

    def validate(self, data):
        start_time = data.get("start")
        end_time = data.get("end")

        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError("Invalid timestamp (start must be before end).")
        return data

    # def validate_organization_slug(
    #     self, organization_slug: str | None
    # ) -> RpcOrganizationSummary | None:
    #     breakpoint()
    #     if organization_slug:
    #         organization = organization_service.get_org_by_slug(slug=organization_slug)
    #         if organization is None:
    #             raise serializers.ValidationError("Invalid organization slug.")
    #         return organization
    #     return None

    # def serialize(
    #     self, obj: Any, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    # ) -> Mapping[str, Any]:
    #     return {
    #         "event_type": obj.event_type,
    #         "errors_only": obj.errors_only,
    #         "org_slug": obj.org_slug,
    #         "start_time": obj.start_time,
    #         "end_time": obj.end_time,
    #     }


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
        breakpoint()
        serializer = IncomingRequestSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        print("VALIDATED", serializer.validated_data)
        event_type = serializer.validated_data.get("event_type")
        errors_only = serializer.validated_data.get("errors_only")
        organization = serializer.validated_data.get("organization")
        start_time = serializer.validated_data.get("start_time")
        end_time = serializer.validated_data.get("end_time")

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

        requests: list[RpcSentryAppRequest] = []

        control_buffer = SentryAppWebhookRequestsBuffer(sentry_app)
        control_errors_only = True if errors_only else False

        def get_buffer_requests_for_control(event) -> list[RpcSentryAppRequest]:
            return [
                serialize_rpc_sentry_app_request(req)
                for req in control_buffer.get_requests(event=event, errors_only=control_errors_only)
            ]

        if event_type == "installation.created" or event_type == "installation.deleted":
            requests.extend(get_buffer_requests_for_control(event_type))
        elif event_type is None:
            control_event_type = [
                "installation.created",
                "installation.deleted",
            ]
            requests.extend(get_buffer_requests_for_control(control_event_type))

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
