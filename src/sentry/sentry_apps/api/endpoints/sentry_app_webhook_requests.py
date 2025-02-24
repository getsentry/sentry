from datetime import datetime, timedelta, timezone

from dateutil.parser import parse as parse_date
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.models.organizationmapping import OrganizationMapping
from sentry.organizations.services.organization import organization_service
from sentry.sentry_apps.api.bases.sentryapps import SentryAppBaseEndpoint, SentryAppStatsPermission
from sentry.sentry_apps.api.serializers.sentry_app_webhook_request import (
    SentryAppWebhookRequestSerializer,
)
from sentry.sentry_apps.api.utils.webhook_requests import (
    BufferedRequest,
    DatetimeOrganizationFilterArgs,
    get_buffer_requests_from_control,
    get_buffer_requests_from_regions,
)
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.services.app_request import SentryAppRequestFilterArgs
from sentry.utils.sentry_apps import EXTENDED_VALID_EVENTS


class IncomingRequestSerializer(serializers.Serializer):
    date_format = "%Y-%m-%d %H:%M:%S"
    eventType = serializers.ChoiceField(
        choices=EXTENDED_VALID_EVENTS,
        required=False,
    )
    errorsOnly = serializers.BooleanField(default=False, required=False)
    organizationSlug = serializers.CharField(required=False)
    start = serializers.DateTimeField(
        format=date_format,
        default=datetime.now(tz=timezone.utc) - timedelta(days=30),
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


@control_silo_endpoint
class SentryAppWebhookRequestsEndpoint(SentryAppBaseEndpoint):
    owner = ApiOwner.ECOSYSTEM
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
        org = organization_service.get(id=sentry_app.owner_id)
        if org is None or not features.has("organizations:sentry-app-webhook-requests", org):
            return Response(status=status.HTTP_403_FORBIDDEN)

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

        requests: list[BufferedRequest] = []
        control_filter: SentryAppRequestFilterArgs = {}
        region_filter: SentryAppRequestFilterArgs = {}
        control_filter["errors_only"] = region_filter["errors_only"] = errors_only
        datetime_org_filter: DatetimeOrganizationFilterArgs = {
            "start_time": start_time,
            "end_time": end_time,
            "organization": organization,
        }

        # If event type is installation.created or installation.deleted, we only need to fetch requests from the control buffer
        if event_type == "installation.created" or event_type == "installation.deleted":
            control_filter["event"] = event_type
            requests.extend(
                get_buffer_requests_from_control(sentry_app, control_filter, datetime_org_filter)
            )
        # If event type has been specified, we only need to fetch requests from region buffers
        elif event_type:
            region_filter["event"] = event_type
            requests.extend(
                get_buffer_requests_from_regions(sentry_app.id, region_filter, datetime_org_filter)
            )
        else:
            control_filter["event"] = [
                "installation.created",
                "installation.deleted",
            ]
            requests.extend(
                get_buffer_requests_from_control(sentry_app, control_filter, datetime_org_filter)
            )
            region_filter["event"] = list(
                set(EXTENDED_VALID_EVENTS)
                - {
                    "installation.created",
                    "installation.deleted",
                }
            )
            requests.extend(
                get_buffer_requests_from_regions(sentry_app.id, region_filter, datetime_org_filter)
            )

        requests.sort(key=lambda x: parse_date(x.data.date), reverse=True)

        return Response(
            serialize(requests, request.user, SentryAppWebhookRequestSerializer(sentry_app))
        )
