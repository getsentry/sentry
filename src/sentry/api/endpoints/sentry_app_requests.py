from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import SentryAppBaseEndpoint, SentryAppStatsPermission

from sentry.utils.sentryappwebhookrequests import (
    SentryAppWebhookRequestsBuffer,
    EXTENDED_VALID_EVENTS,
)

from sentry.models import Organization, Project


class SentryAppRequestsEndpoint(SentryAppBaseEndpoint):
    permission_classes = (SentryAppStatsPermission,)

    def format_request(self, request, sentry_app):
        formatted_request = {
            "webhookUrl": request.get("webhook_url"),
            "sentryAppSlug": sentry_app.slug,
            "eventType": request.get("event_type"),
            "date": request.get("date"),
            "responseCode": request.get("response_code"),
        }

        if "error_id" in request and "project_id" in request:
            try:
                project = Project.objects.get_from_cache(id=request["project_id"])
                # Make sure the project actually belongs to the org that owns the Sentry App
                if project.organization_id == sentry_app.owner_id:
                    error_url = "/organizations/{}/projects/{}/events/{}/".format(
                        sentry_app.owner.slug, project.slug, request["error_id"]
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

        return formatted_request

    def get(self, request, sentry_app):
        """
        :qparam string eventType: Optionally specify a specific event type to filter requests
        :qparam bool errorsOnly: If this is true, only return error/warning requests (300-599)
        """

        event_type = request.GET.get("eventType")
        errors_only = request.GET.get("errorsOnly")

        kwargs = {}
        if event_type:
            if event_type not in EXTENDED_VALID_EVENTS:
                return Response({"detail": "Invalid event type."}, status=400)
            kwargs["event"] = event_type
        if errors_only:
            kwargs["errors_only"] = True

        buffer = SentryAppWebhookRequestsBuffer(sentry_app)

        formatted_requests = [
            self.format_request(req, sentry_app) for req in buffer.get_requests(**kwargs)
        ]

        return Response(formatted_requests)
