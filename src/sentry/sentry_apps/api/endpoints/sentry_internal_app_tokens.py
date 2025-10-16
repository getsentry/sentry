from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers.models.apitoken import ApiTokenSerializer
from sentry.exceptions import ApiTokenLimitError
from sentry.models.apitoken import ApiToken
from sentry.sentry_apps.api.bases.sentryapps import (
    SentryAppBaseEndpoint,
    SentryInternalAppTokenPermission,
)
from sentry.sentry_apps.api.endpoints.sentry_app_details import PARTNERSHIP_RESTRICTED_ERROR_MESSAGE
from sentry.sentry_apps.installations import SentryAppInstallationTokenCreator
from sentry.sentry_apps.models.sentry_app import MASKED_VALUE
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.audit import create_audit_entry


@control_silo_endpoint
class SentryInternalAppTokensEndpoint(SentryAppBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (SentryInternalAppTokenPermission,)

    def get(self, request: Request, sentry_app) -> Response:
        if not sentry_app.is_internal:
            return Response([])

        tokens = ApiToken.objects.filter(application_id=sentry_app.application_id)
        attrs = {"application": None}

        token_list = [
            ApiTokenSerializer().serialize(token, attrs, request.user, include_token=False)
            for token in tokens
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
            assert isinstance(
                request.user, (User, RpcUser)
            ), "User must be authenticated to install a sentry app"
            api_token = SentryAppInstallationTokenCreator(
                sentry_app_installation=sentry_app_installation
            ).run(request=request, user=request.user)

            create_audit_entry(
                request=request,
                organization_id=sentry_app_installation.organization_id,
                target_object=api_token.id,
                event=audit_log.get_event_id("INTERNAL_INTEGRATION_ADD_TOKEN"),
                data={
                    "sentry_app_slug": sentry_app.slug,
                    "sentry_app_installation_uuid": sentry_app_installation.uuid,
                },
            )
        except ApiTokenLimitError as e:
            return Response(str(e), status=status.HTTP_403_FORBIDDEN)

        # hack so the token is included in the response
        attrs = {"application": None}
        token = ApiTokenSerializer().serialize(api_token, attrs, request.user)

        if not sentry_app.show_auth_info(request.access):
            token["token"] = MASKED_VALUE
            token["refreshToken"] = MASKED_VALUE

        return Response(token, status=201)
