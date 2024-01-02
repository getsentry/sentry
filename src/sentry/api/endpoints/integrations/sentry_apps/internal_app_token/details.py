from django.db import router, transaction
from django.http import Http404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, deletions
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases import SentryAppBaseEndpoint, SentryInternalAppTokenPermission
from sentry.api.endpoints.integrations.sentry_apps.details import (
    PARTNERSHIP_RESTRICTED_ERROR_MESSAGE,
)
from sentry.models.apitoken import ApiToken
from sentry.models.integrations.sentry_app_installation_token import SentryAppInstallationToken


@control_silo_endpoint
class SentryInternalAppTokenDetailsEndpoint(SentryAppBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (SentryInternalAppTokenPermission,)

    def convert_args(self, request: Request, sentry_app_slug, api_token, *args, **kwargs):
        # get the sentry_app from the SentryAppBaseEndpoint class
        (args, kwargs) = super().convert_args(request, sentry_app_slug, *args, **kwargs)

        try:
            kwargs["api_token"] = ApiToken.objects.get(token=api_token)
        except ApiToken.DoesNotExist:
            raise Http404

        return (args, kwargs)

    def delete(self, request: Request, sentry_app, api_token) -> Response:
        # Validate the token is associated with the application
        if api_token.application_id != sentry_app.application_id:
            raise Http404

        if not sentry_app.is_internal:
            return Response(
                "This route is limited to internal integrations only",
                status=status.HTTP_403_FORBIDDEN,
            )

        if sentry_app.metadata.get("partnership_restricted", False):
            return Response(
                {"detail": PARTNERSHIP_RESTRICTED_ERROR_MESSAGE},
                status=403,
            )

        with transaction.atomic(using=router.db_for_write(SentryAppInstallationToken)):
            try:
                install_token = SentryAppInstallationToken.objects.get(api_token=api_token)
                sentry_app_installation = install_token.sentry_app_installation
            except SentryAppInstallationToken.DoesNotExist:
                raise Http404

            deletions.exec_sync(install_token)

        analytics.record(
            "sentry_app_installation_token.deleted",
            user_id=request.user.id,
            organization_id=sentry_app_installation.organization_id,
            sentry_app_installation_id=sentry_app_installation.id,
            sentry_app=sentry_app.slug,
        )

        return Response(status=204)
