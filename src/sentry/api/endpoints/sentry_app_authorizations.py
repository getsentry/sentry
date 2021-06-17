import logging

import sentry_sdk
from rest_framework.response import Response

from sentry.api.bases import SentryAppAuthorizationsBaseEndpoint
from sentry.api.serializers.models.apitoken import ApiTokenSerializer
from sentry.coreapi import APIUnauthorized
from sentry.mediators.token_exchange import GrantExchanger, GrantTypes, Refresher

logger = logging.getLogger(__name__)


class SentryAppAuthorizationsEndpoint(SentryAppAuthorizationsBaseEndpoint):
    def post(self, request, installation):
        with sentry_sdk.configure_scope() as scope:
            scope.set_tag("organization", installation.organization_id)
            scope.set_tag("sentry_app_id", installation.sentry_app_id)
            scope.set_tag("sentry_app_slug", installation.sentry_app.slug)

            try:
                if request.json_body.get("grant_type") == GrantTypes.AUTHORIZATION:
                    token = GrantExchanger.run(
                        install=installation,
                        code=request.json_body.get("code"),
                        client_id=request.json_body.get("client_id"),
                        user=request.user,
                    )
                elif request.json_body.get("grant_type") == GrantTypes.REFRESH:
                    token = Refresher.run(
                        install=installation,
                        refresh_token=request.json_body.get("refresh_token"),
                        client_id=request.json_body.get("client_id"),
                        user=request.user,
                    )
                else:
                    return Response({"error": "Invalid grant_type"}, status=403)
            except APIUnauthorized as e:
                logger.warning(e, exc_info=True)
                return Response({"error": e.msg or "Unauthorized"}, status=403)

            attrs = {"state": request.json_body.get("state"), "application": None}

            body = ApiTokenSerializer().serialize(token, attrs, request.user)

            return Response(body, status=201)
