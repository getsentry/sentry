import logging

import sentry_sdk
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers.models.apitoken import ApiTokenSerializer
from sentry.auth.services.auth.impl import promote_request_api_user
from sentry.organizations.services.organization.service import organization_service
from sentry.security.utils import capture_security_app_activity
from sentry.sentry_apps.api.bases.sentryapps import SentryAppAuthorizationsBaseEndpoint
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.token_exchange.grant_exchanger import GrantExchanger
from sentry.sentry_apps.token_exchange.manual_refresher import ManualTokenRefresher
from sentry.sentry_apps.token_exchange.refresher import Refresher
from sentry.sentry_apps.token_exchange.util import GrantTypes
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError

logger = logging.getLogger(__name__)


class SentryAppRefreshAuthorizationSerializer(serializers.Serializer):
    client_id = serializers.CharField(required=True, allow_null=False)
    refresh_token = serializers.CharField(required=True, allow_null=False)
    grant_type = serializers.CharField(required=True, allow_null=False)


class SentryAppAuthorizationSerializer(serializers.Serializer):
    client_id = serializers.CharField(required=True, allow_null=False)
    grant_type = serializers.CharField(required=True, allow_null=False)
    code = serializers.CharField(required=True, allow_null=False)


class SentryAppClientSecretJWTSerializer(serializers.Serializer):
    grant_type = serializers.CharField(required=True, allow_null=False)


@control_silo_endpoint
class SentryAppAuthorizationsEndpoint(SentryAppAuthorizationsBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, installation: SentryAppInstallation) -> Response:
        scope = sentry_sdk.get_isolation_scope()
        scope.set_tag("organization", installation.organization_id)
        scope.set_tag("sentry_app_id", installation.sentry_app.id)
        scope.set_tag("sentry_app_slug", installation.sentry_app.slug)

        context = organization_service.get_organization_by_id(
            id=installation.organization_id, include_projects=False, include_teams=False
        )
        if context is None:
            return Response(
                status=500, data={"detail": "Organization not found, please try again later"}
            )

        try:
            if request.data.get("grant_type") == GrantTypes.AUTHORIZATION:
                auth_serializer: SentryAppAuthorizationSerializer = (
                    SentryAppAuthorizationSerializer(data=request.data)
                )

                if not auth_serializer.is_valid():
                    return Response(auth_serializer.errors, status=400)

                token = GrantExchanger(
                    install=installation,
                    code=auth_serializer.validated_data.get("code"),
                    client_id=auth_serializer.validated_data.get("client_id"),
                    user=promote_request_api_user(request),
                ).run()
            elif request.data.get("grant_type") == GrantTypes.REFRESH:
                refresh_serializer = SentryAppRefreshAuthorizationSerializer(data=request.data)

                if not refresh_serializer.is_valid():
                    return Response(refresh_serializer.errors, status=400)

                token = Refresher(
                    install=installation,
                    refresh_token=refresh_serializer.validated_data.get("refresh_token"),
                    client_id=refresh_serializer.validated_data.get("client_id"),
                    user=promote_request_api_user(request),
                ).run()
            elif request.data.get("grant_type") == GrantTypes.CLIENT_SECRET_JWT:
                if not features.has(
                    "organizations:sentry-app-manual-token-refresh",
                    context.organization,
                    actor=request.user,
                ):
                    raise SentryAppIntegratorError(
                        message="Manual token refresh is not enabled for this organization",
                        status_code=403,
                    )

                client_secret_jwt_serializer = SentryAppClientSecretJWTSerializer(data=request.data)
                if not client_secret_jwt_serializer.is_valid():
                    return Response(client_secret_jwt_serializer.errors, status=400)

                # we've already validated the JWT in the authentication class so we can use the payload
                payload = getattr(request, "jwt_payload", None)
                if not payload:
                    raise SentryAppIntegratorError(
                        message="JWT credentials are missing or invalid", status_code=403
                    )

                user = promote_request_api_user(request)
                token = ManualTokenRefresher(
                    install=installation,
                    client_id=payload["iss"],
                    user=user,
                ).run()

            else:
                raise SentryAppIntegratorError(message="Invalid grant_type", status_code=403)

        except SentryAppIntegratorError as e:
            logger.info(
                "sentry-app-authorizations.error-context",
                exc_info=e,
                extra={
                    "user_id": request.user.id,
                    "sentry_app_installation_id": installation.id,
                    "organization_id": installation.organization_id,
                    "sentry_app_id": installation.sentry_app.id,
                },
            )
            raise

        capture_security_app_activity(
            organization=context.organization,
            sentry_app=installation.sentry_app,
            activity_type=self._get_activity_type(request),
            ip_address=request.META["REMOTE_ADDR"],
            context={
                "installation_id": installation.id,
            },
        )
        attrs = {"state": request.data.get("state"), "application": None}

        body = ApiTokenSerializer().serialize(token, attrs, promote_request_api_user(request))

        return Response(body, status=201)

    def _get_activity_type(self, request: Request) -> str:
        if request.data.get("grant_type") == GrantTypes.AUTHORIZATION:
            return "sentry-app-token-authorizations"
        elif request.data.get("grant_type") == GrantTypes.REFRESH:
            return "sentry-app-token-refreshed"
        elif request.data.get("grant_type") == GrantTypes.CLIENT_SECRET_JWT:
            return "sentry-app-token-manual-refresh"
        else:
            return "sentry-app-token-invalid-grant-type"
