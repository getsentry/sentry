import sentry_sdk
from django.db import transaction
from requests import RequestException
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log, deletions
from sentry.api.base import control_silo_endpoint
from sentry.api.bases import SentryAppInstallationBaseEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import SentryAppInstallationSerializer
from sentry.mediators import InstallationNotifier
from sentry.mediators.sentry_app_installations import Updater
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.models.user import User
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.utils.audit import create_audit_entry
from sentry.utils.functional import extract_lazy_object


@control_silo_endpoint
class SentryAppInstallationDetailsEndpoint(SentryAppInstallationBaseEndpoint):
    def get(self, request: Request, installation) -> Response:
        return Response(serialize(SentryAppInstallation.objects.get(id=installation.id)))

    def delete(self, request: Request, installation) -> Response:
        installation = SentryAppInstallation.objects.get(id=installation.id)
        user = extract_lazy_object(request.user)
        if isinstance(user, RpcUser):
            user = User.objects.get(id=user.id)
        with transaction.atomic():
            try:
                InstallationNotifier.run(install=installation, user=user, action="deleted")
            # if the error is from a request exception, log the error and continue
            except RequestException as exc:
                sentry_sdk.capture_exception(exc)
            deletions.exec_sync(installation)
            create_audit_entry(
                request=request,
                organization_id=installation.organization_id,
                target_object=installation.organization_id,
                event=audit_log.get_event_id("SENTRY_APP_UNINSTALL"),
                data={"sentry_app": installation.sentry_app.name},
            )
        analytics.record(
            "sentry_app.uninstalled",
            user_id=request.user.id,
            organization_id=installation.organization_id,
            sentry_app=installation.sentry_app.slug,
        )
        return Response(status=204)

    def put(self, request: Request, installation) -> Response:
        serializer = SentryAppInstallationSerializer(installation, data=request.data, partial=True)

        if serializer.is_valid():
            result = serializer.validated_data

            Updater.run(
                user=request.user, sentry_app_installation=installation, status=result.get("status")
            )

            return Response(
                serialize(SentryAppInstallation.objects.get(id=installation.id), request.user)
            )
        return Response(serializer.errors, status=400)
