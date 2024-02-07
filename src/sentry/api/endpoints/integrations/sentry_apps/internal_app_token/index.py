from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases import SentryAppBaseEndpoint, SentryInternalAppTokenPermission
from sentry.api.endpoints.integrations.sentry_apps.details import (
    PARTNERSHIP_RESTRICTED_ERROR_MESSAGE,
)
from sentry.api.serializers.models.apitoken import ApiTokenSerializer
from sentry.exceptions import ApiTokenLimitError
from sentry.models.apitoken import ApiToken
from sentry.models.integrations.sentry_app import MASKED_VALUE
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.installations import SentryAppInstallationTokenCreator


@control_silo_endpoint
class SentryInternalAppTokensEndpoint(SentryAppBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (SentryInternalAppTokenPermission,)

    def get(self, request: Request, sentry_app) -> Response:
        if not sentry_app.is_internal:
            return Response([])

        tokens = ApiToken.objects.filter(application_id=sentry_app.application_id)
        attrs = {"application": None}

        token_list = [
            ApiTokenSerializer().serialize(token, attrs, request.user) for token in tokens
        ]

        if not sentry_app.show_auth_info(request.access):
            for token in token_list:
                token["token"] = MASKED_VALUE
                token["refreshToken"] = MASKED_VALUE

        return Response(token_list)

    def post(self, request: Request, sentry_app) -> Response:
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
        sentry_app_installation = SentryAppInstallation.objects.get(sentry_app_id=sentry_app.id)
        try:
            api_token = SentryAppInstallationTokenCreator(
                sentry_app_installation=sentry_app_installation
            ).run(request=request, user=request.user)
        except ApiTokenLimitError as e:
            return Response(str(e), status=status.HTTP_403_FORBIDDEN)

        # hack so the token is included in the response
        attrs = {"application": None}
        token = ApiTokenSerializer().serialize(api_token, attrs, request.user)

        if not sentry_app.show_auth_info(request.access):
            token["token"] = MASKED_VALUE
            token["refreshToken"] = MASKED_VALUE

        return Response(token, status=201)
