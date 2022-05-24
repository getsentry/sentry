from datetime import datetime

from django.urls import reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.bases import SentryAppBaseEndpoint, SentryAppStatsPermission
from sentry.models import Organization, Project
from sentry.utils.sentry_apps import EXTENDED_VALID_EVENTS, SentryAppWebhookRequestsBuffer


class SentryAppRequestsEndpoint(SentryAppBaseEndpoint):
    permission_classes = (SentryAppStatsPermission,)

    def format_request(self, request: Request, sentry_app, org_slug: str = None):
        response_code = request.get("response_code")
        formatted_request = {
            "webhookUrl": request.get("webhook_url"),
            "sentryAppSlug": sentry_app.slug,
            "eventType": request.get("event_type"),
            "date": request.get("date"),
            "responseCode": response_code,
        }

        if response_code >= 400 or response_code == 0:
            formatted_request["requestBody"] = request.get("request_body")
            formatted_request["requestHeaders"] = request.get("request_headers")
            formatted_request["responseBody"] = request.get("response_body")

        if "error_id" in request and "project_id" in request:
            try:
                project = Project.objects.get_from_cache(id=request["project_id"])
                # Make sure the project actually belongs to the org that owns the Sentry App
                if project.organization_id == sentry_app.owner_id:
                    # Make sure the event actually exists
                    event = eventstore.get_event_by_id(project.id, request["error_id"])
                    if event is not None and event.group_id is not None:
                        error_url = reverse(
                            "sentry-organization-event-detail",
                            args=[project.organization.slug, event.group_id, event.event_id],
                        )
                        formatted_request["errorUrl"] = error_url

            except Project.DoesNotExist:
                # If the project doesn't exist, don't add the error to the result
                pass

        if "organization_id" in request:
            try:
                org = Organization.objects.get_from_cache(id=request["organization_id"])
                formatted_request["organization"] = {"name": org.name, "slug": org.slug}
            except Organization.DoesNotExist:
                # If the org somehow doesn't exist, just don't add it to the result
                pass

        if org_slug and not formatted_request.get("organization", {}).get("slug") == org_slug:
            return {}

        return formatted_request

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
        invalid_date_format_message = "Invalid date format. Format must be YYYY-MM-DD HH:MM:SS."

        event_type = request.GET.get("eventType")
        errors_only = request.GET.get("errorsOnly")
        org_slug = request.GET.get("organizationSlug")
        start = request.GET.get("start", default_start)
        end = request.GET.get("end", now)

        try:
            start = datetime.strptime(start, date_format)
        except ValueError:
            return Response({"detail": invalid_date_format_message})

        try:
            end = datetime.strptime(end, date_format)
        except ValueError:
            return Response({"detail": invalid_date_format_message})

        kwargs = {}
        if event_type:
            if event_type not in EXTENDED_VALID_EVENTS:
                return Response({"detail": "Invalid event type."}, status=400)
            kwargs["event"] = event_type
        if errors_only:
            kwargs["errors_only"] = True

        buffer = SentryAppWebhookRequestsBuffer(sentry_app)

        formatted_requests = [
            self.format_request(req, sentry_app, org_slug) for req in buffer.get_requests(**kwargs)
        ]

        if start == default_start and end == now:
            return Response(formatted_requests)

        filtered_requests = []
        for formatted_request in formatted_requests:
            if formatted_request.get("date"):
                date = datetime.strptime(
                    formatted_request["date"], "%Y-%m-%d %H:%M:%S.%f+00:00"
                ).replace(microsecond=0)
                if date >= start and date <= end:
                    filtered_requests.append(formatted_request)

        return Response(filtered_requests)
