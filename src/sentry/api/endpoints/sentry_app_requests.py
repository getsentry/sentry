from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import SentryAppBaseEndpoint, SentryAppStatsPermission

from sentry.utils.sentryappwebhookrequests import SentryAppWebhookRequestsBuffer

from sentry.models import Organization


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

        if "error_id" in request:
            formatted_request["errorId"] = request.get("error_id")

        if "organization_id" in request:
            try:
                org = Organization.objects.get_from_cache(id=request["organization_id"])
                formatted_request["organization"] = {"name": org.name, "slug": org.slug}
            except Organization.DoesNotExist:
                # If the org somehow doesn't exist, just don't add it to the result
                pass

        return formatted_request

    def get(self, request, sentry_app):

        # TODO add optional query params for event type
        # for now I'm just getting all requests for all events

        buffer = SentryAppWebhookRequestsBuffer(sentry_app)

        formatted_requests = [self.format_request(req, sentry_app) for req in buffer.get_requests()]

        return Response(formatted_requests)
