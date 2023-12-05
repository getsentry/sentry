import logging

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases import SentryAppAuthorizationsBaseEndpoint
from sentry.api.serializers.models.apitoken import ApiTokenSerializer
from sentry.coreapi import APIUnauthorized
from sentry.mediators.token_exchange.grant_exchanger import GrantExchanger
from sentry.mediators.token_exchange.refresher import Refresher
from sentry.mediators.token_exchange.util import GrantTypes
from sentry.services.hybrid_cloud.auth.impl import promote_request_api_user

logger = logging.getLogger(__name__)


@control_silo_endpoint
class SentryAppAuthorizationsEndpoint(SentryAppAuthorizationsBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.UNKNOWN,
    }

    def post(self, request: Request, installation) -> Response:
        with sentry_sdk.configure_scope() as scope:
            scope.set_tag("organization", installation.organization_id)
            scope.set_tag("sentry_app_id", installation.sentry_app.id)
            scope.set_tag("sentry_app_slug", installation.sentry_app.slug)

            try:
                if request.json_body.get("grant_type") == GrantTypes.AUTHORIZATION:
                    token = GrantExchanger.run(
                        install=installation,
                        code=request.json_body.get("code"),
                        client_id=request.json_body.get("client_id"),
                        user=promote_request_api_user(request),
                    )
                elif request.json_body.get("grant_type") == GrantTypes.REFRESH:
                    token = Refresher.run(
                        install=installation,
                        refresh_token=request.json_body.get("refresh_token"),
                        client_id=request.json_body.get("client_id"),
                        user=promote_request_api_user(request),
                    )
                else:
                    return Response({"error": "Invalid grant_type"}, status=403)
            except APIUnauthorized as e:
                logger.warning(e, exc_info=True)
                return Response({"error": e.msg or "Unauthorized"}, status=403)

            attrs = {"state": request.json_body.get("state"), "application": None}

            body = ApiTokenSerializer().serialize(token, attrs, promote_request_api_user(request))

            return Response(body, status=201)
