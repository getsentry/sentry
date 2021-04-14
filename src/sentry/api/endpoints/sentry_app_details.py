import logging

from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.bases.sentryapps import SentryAppBaseEndpoint, catch_raised_errors
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import SentryAppSerializer
from sentry.constants import SentryAppStatus
from sentry.mediators.sentry_apps import Destroyer, Updater
from sentry.utils import json

logger = logging.getLogger(__name__)


class SentryAppDetailsEndpoint(SentryAppBaseEndpoint):
    def get(self, request, sentry_app):
        return Response(serialize(sentry_app, request.user, access=request.access))

    @catch_raised_errors
    def put(self, request, sentry_app):
        if self._has_hook_events(request) and not features.has(
            "organizations:integrations-event-hooks", sentry_app.owner, actor=request.user
        ):

            return Response(
                {
                    "non_field_errors": [
                        "Your organization does not have access to the 'error' resource subscription."
                    ]
                },
                status=403,
            )

        # isInternal is not field of our model but it is a field of the serializer
        data = request.data.copy()
        data["isInternal"] = sentry_app.status == SentryAppStatus.INTERNAL
        serializer = SentryAppSerializer(sentry_app, data=data, partial=True, access=request.access)

        if serializer.is_valid():
            result = serializer.validated_data

            updated_app = Updater.run(
                user=request.user,
                sentry_app=sentry_app,
                name=result.get("name"),
                author=result.get("author"),
                status=result.get("status"),
                webhook_url=result.get("webhookUrl"),
                redirect_url=result.get("redirectUrl"),
                is_alertable=result.get("isAlertable"),
                verify_install=result.get("verifyInstall"),
                scopes=result.get("scopes"),
                events=result.get("events"),
                schema=result.get("schema"),
                overview=result.get("overview"),
                allowed_origins=result.get("allowedOrigins"),
            )

            return Response(serialize(updated_app, request.user, access=request.access))

        # log any errors with schema
        if "schema" in serializer.errors:
            for error_message in serializer.errors["schema"]:
                name = "sentry_app.schema_validation_error"
                log_info = {
                    "schema": json.dumps(request.data["schema"]),
                    "user_id": request.user.id,
                    "sentry_app_id": sentry_app.id,
                    "sentry_app_name": sentry_app.name,
                    "organization_id": sentry_app.owner.id,
                    "error_message": error_message,
                }
                logger.info(name, extra=log_info)
                analytics.record(name, **log_info)

        return Response(serializer.errors, status=400)

    def delete(self, request, sentry_app):
        if sentry_app.is_unpublished or sentry_app.is_internal:
            Destroyer.run(user=request.user, sentry_app=sentry_app, request=request)
            return Response(status=204)

        return Response({"detail": ["Published apps cannot be removed."]}, status=403)

    def _has_hook_events(self, request):
        if not request.json_body.get("events"):
            return False

        return "error" in request.json_body["events"]
