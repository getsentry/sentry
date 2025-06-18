import sentry_sdk
from django.db import router, transaction
from requests import RequestException
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log, deletions
from sentry.analytics.events.sentry_app_uninstalled import SentryAppUninstalledEvent
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationBaseEndpoint
from sentry.sentry_apps.api.parsers.sentry_app_installation import SentryAppInstallationParser
from sentry.sentry_apps.api.serializers.sentry_app_installation import (
    SentryAppInstallationSerializer,
)
from sentry.sentry_apps.installations import (
    SentryAppInstallationNotifier,
    SentryAppInstallationUpdater,
)
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.utils.audit import create_audit_entry


@control_silo_endpoint
class SentryAppInstallationDetailsEndpoint(SentryAppInstallationBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, installation) -> Response:
        return Response(
            serialize(
                objects=SentryAppInstallation.objects.get(id=installation.id),
                access=request.access,
                serializer=SentryAppInstallationSerializer(),
            )
        )

    def delete(self, request: Request, installation) -> Response:
        sentry_app_installation = SentryAppInstallation.objects.get(id=installation.id)
        with transaction.atomic(using=router.db_for_write(SentryAppInstallation)):
            try:
                assert (
                    request.user.is_authenticated
                ), "User must be authenticated to delete installation"
                SentryAppInstallationNotifier(
                    sentry_app_installation=sentry_app_installation,
                    user=request.user,
                    action="deleted",
                ).run()
            # if the error is from a request exception, log the error and continue
            except RequestException as exc:
                sentry_sdk.capture_exception(exc)
            deletions.exec_sync(sentry_app_installation)
            create_audit_entry(
                request=request,
                organization_id=sentry_app_installation.organization_id,
                target_object=sentry_app_installation.organization_id,
                event=audit_log.get_event_id("SENTRY_APP_UNINSTALL"),
                data={"sentry_app": sentry_app_installation.sentry_app.name},
            )
        analytics.record(
            SentryAppUninstalledEvent(
                user_id=request.user.id,
                organization_id=sentry_app_installation.organization_id,
                sentry_app=sentry_app_installation.sentry_app.slug,
            )
        )
        return Response(status=204)

    def put(self, request: Request, installation) -> Response:
        serializer = SentryAppInstallationParser(installation, data=request.data, partial=True)

        if serializer.is_valid():
            result = serializer.validated_data

            SentryAppInstallationUpdater(
                sentry_app_installation=installation, status=result.get("status")
            ).run()

            return Response(
                serialize(
                    objects=SentryAppInstallation.objects.get(id=installation.id),
                    user=request.user,
                    serializer=SentryAppInstallationSerializer(),
                )
            )
        return Response(serializer.errors, status=400)
