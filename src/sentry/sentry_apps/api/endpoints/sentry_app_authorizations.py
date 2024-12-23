import logging

import sentry_sdk
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers.models.apitoken import ApiTokenSerializer
from sentry.auth.services.auth.impl import promote_request_api_user
from sentry.coreapi import APIUnauthorized
from sentry.sentry_apps.api.bases.sentryapps import SentryAppAuthorizationsBaseEndpoint
from sentry.sentry_apps.token_exchange.grant_exchanger import GrantExchanger
from sentry.sentry_apps.token_exchange.refresher import Refresher
from sentry.sentry_apps.token_exchange.util import GrantTypes

logger = logging.getLogger(__name__)


class SentryAppRefreshAuthorizationSerializer(serializers.Serializer):
    client_id = serializers.CharField(required=True, allow_null=False)
    refresh_token = serializers.CharField(required=True, allow_null=False)
    grant_type = serializers.CharField(required=True, allow_null=False)


class SentryAppAuthorizationSerializer(serializers.Serializer):
    client_id = serializers.CharField(required=True, allow_null=False)
    grant_type = serializers.CharField(required=True, allow_null=False)
    code = serializers.CharField(required=True, allow_null=False)


@control_silo_endpoint
class SentryAppAuthorizationsEndpoint(SentryAppAuthorizationsBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, installation) -> Response:
        scope = sentry_sdk.Scope.get_isolation_scope()

        scope.set_tag("organization", installation.organization_id)
        scope.set_tag("sentry_app_id", installation.sentry_app.id)
        scope.set_tag("sentry_app_slug", installation.sentry_app.slug)

        try:
            if request.data.get("grant_type") == GrantTypes.AUTHORIZATION:
                auth_serializer: SentryAppAuthorizationSerializer = (
                    SentryAppAuthorizationSerializer(data=request.data)
                )

                if not auth_serializer.is_valid():
                    return Response(auth_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

                token = GrantExchanger(
                    install=installation,
                    code=auth_serializer.validated_data.get("code"),
                    client_id=auth_serializer.validated_data.get("client_id"),
                    user=promote_request_api_user(request),
                ).run()
            elif request.data.get("grant_type") == GrantTypes.REFRESH:
                refresh_serializer = SentryAppRefreshAuthorizationSerializer(data=request.data)

                if not refresh_serializer.is_valid():
                    return Response(refresh_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

                token = Refresher(
                    install=installation,
                    refresh_token=refresh_serializer.validated_data.get("refresh_token"),
                    client_id=refresh_serializer.validated_data.get("client_id"),
                    user=promote_request_api_user(request),
                ).run()
            else:
                return Response({"error": "Invalid grant_type"}, status=403)
        except APIUnauthorized as e:
            logger.warning(
                e,
                exc_info=True,
                extra={
                    "user_id": request.user.id,
                    "sentry_app_installation_id": installation.id,
                    "organization_id": installation.organization_id,
                    "sentry_app_id": installation.sentry_app.id,
                },
            )
            return Response({"error": e.msg or "Unauthorized"}, status=403)

        attrs = {"state": request.data.get("state"), "application": None}

        body = ApiTokenSerializer().serialize(token, attrs, promote_request_api_user(request))

        return Response(body, status=201)
