import sentry_sdk
from django.db import router, transaction
from drf_spectacular.utils import extend_schema
from requests import RequestException
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log
from sentry.analytics.events.sentry_app_uninstalled import SentryAppUninstalledEvent
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import SentryAppParams
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import SentryAppInstallationStatus
from sentry.deletions.models.scheduleddeletion import ScheduledDeletion
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationBaseEndpoint
from sentry.sentry_apps.api.parsers.sentry_app_installation import SentryAppInstallationParser
from sentry.sentry_apps.api.serializers.sentry_app_installation import (
    SentryAppInstallationResult,
    SentryAppInstallationSerializer,
)
from sentry.sentry_apps.installations import (
    SentryAppInstallationNotifier,
    SentryAppInstallationUpdater,
)
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.utils.audit import create_audit_entry
from sentry.utils.sentry_apps.webhooks import WebhookTimeoutError


@extend_schema(tags=["Integration"])
@control_silo_endpoint
class SentryAppInstallationDetailsEndpoint(SentryAppInstallationBaseEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    allow_disabled_sentry_app_for_methods = {"DELETE"}

    @extend_schema(
        operation_id="Retrieve a Sentry App Installation",
        parameters=[SentryAppParams.INSTALLATION_UUID],
        responses={
            200: inline_sentry_response_serializer(
                "SentryAppInstallation", SentryAppInstallationResult
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, installation) -> Response[SentryAppInstallationResult]:
        """
        Return details about a single custom integration (Sentry App) installation.
        """
        return Response(
            serialize(
                objects=SentryAppInstallation.objects.get(id=installation.id),
                access=request.access,
                serializer=SentryAppInstallationSerializer(),
            )
        )

    @extend_schema(
        operation_id="Uninstall a Sentry App",
        parameters=[SentryAppParams.INSTALLATION_UUID],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, installation) -> Response:
        """
        Uninstall a custom integration (Sentry App) from an organization.
        """
        sentry_app_installation = SentryAppInstallation.objects.get(id=installation.id)
        db = router.db_for_write(SentryAppInstallation)

        with transaction.atomic(using=db):
            sentry_app_installation.update(status=SentryAppInstallationStatus.PENDING_DELETION)
            ScheduledDeletion.schedule(sentry_app_installation, days=0, actor=request.user)
            create_audit_entry(
                request=request,
                organization_id=sentry_app_installation.organization_id,
                target_object=sentry_app_installation.organization_id,
                event=audit_log.get_event_id("SENTRY_APP_UNINSTALL"),
                data={"sentry_app": sentry_app_installation.sentry_app.name},
            )

            def notify_on_commit() -> None:
                try:
                    assert request.user.is_authenticated, (
                        "User must be authenticated to delete installation"
                    )
                    SentryAppInstallationNotifier(
                        sentry_app_installation=sentry_app_installation,
                        user=request.user,
                        action="deleted",
                    ).run()
                except RequestException as exc:
                    sentry_sdk.capture_exception(exc)
                except WebhookTimeoutError:
                    pass

            transaction.on_commit(notify_on_commit, using=db)
        if request.user.is_authenticated:
            analytics.record(
                SentryAppUninstalledEvent(
                    user_id=request.user.id,
                    organization_id=sentry_app_installation.organization_id,
                    sentry_app=sentry_app_installation.sentry_app.slug,
                ),
            )
        return Response(status=204)

    @extend_schema(
        operation_id="Update a Sentry App Installation",
        parameters=[SentryAppParams.INSTALLATION_UUID],
        request=SentryAppInstallationParser,
        responses={
            200: inline_sentry_response_serializer(
                "SentryAppInstallation", SentryAppInstallationResult
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self, request: Request, installation
    ) -> Response[SentryAppInstallationResult] | Response[ValidationErrorResponse]:
        """
        Update a custom integration (Sentry App) installation, for example to mark a
        pending installation as installed.
        """
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
        return Response(as_validation_errors(serializer), status=400)
