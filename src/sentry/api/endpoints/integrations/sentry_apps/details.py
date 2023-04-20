import logging

import sentry_sdk
from django.db import transaction
from requests import RequestException
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log, deletions, features
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.sentryapps import SentryAppBaseEndpoint, catch_raised_errors
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import SentryAppSerializer
from sentry.constants import SentryAppStatus
from sentry.mediators import InstallationNotifier
from sentry.sentry_apps.apps import SentryAppUpdater
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.utils import json
from sentry.utils.audit import create_audit_entry

logger = logging.getLogger(__name__)


@control_silo_endpoint
class SentryAppDetailsEndpoint(SentryAppBaseEndpoint):
    def get(self, request: Request, sentry_app) -> Response:
        return Response(serialize(sentry_app, request.user, access=request.access))

    @catch_raised_errors
    def put(self, request: Request, sentry_app) -> Response:
        owner_context = organization_service.get_organization_by_id(
            id=sentry_app.owner_id, user_id=None
        )
        if (
            owner_context
            and self._has_hook_events(request)
            and not features.has(
                "organizations:integrations-event-hooks",
                owner_context.organization,
                actor=request.user,
            )
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
            updated_app = SentryAppUpdater(
                sentry_app=sentry_app,
                name=result.get("name"),
                author=result.get("author"),
                features=result.get("features"),
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
                popularity=result.get("popularity"),
            ).run(user=request.user)

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
                    "organization_id": sentry_app.owner_id,
                    "error_message": error_message,
                }
                logger.info(name, extra=log_info)
                analytics.record(name, **log_info)

        return Response(serializer.errors, status=400)

    def delete(self, request: Request, sentry_app) -> Response:
        if sentry_app.is_unpublished or sentry_app.is_internal:
            if not sentry_app.is_internal:
                for install in sentry_app.installations.all():
                    try:
                        with transaction.atomic():
                            InstallationNotifier.run(
                                install=install, user=request.user, action="deleted"
                            )
                            deletions.exec_sync(install)
                    except RequestException as exc:
                        sentry_sdk.capture_exception(exc)

            with transaction.atomic():
                deletions.exec_sync(sentry_app)
                create_audit_entry(
                    request=request,
                    organization_id=sentry_app.owner_id,
                    target_object=sentry_app.owner_id,
                    event=audit_log.get_event_id("SENTRY_APP_REMOVE"),
                    data={"sentry_app": sentry_app.name},
                )
            analytics.record(
                "sentry_app.deleted",
                user_id=request.user.id,
                organization_id=sentry_app.owner_id,
                sentry_app=sentry_app.slug,
            )
            return Response(status=204)

        return Response({"detail": ["Published apps cannot be removed."]}, status=403)

    def _has_hook_events(self, request: Request):
        if not request.json_body.get("events"):
            return False

        return "error" in request.json_body["events"]
