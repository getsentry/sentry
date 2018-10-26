from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import SentryAppAuthorizationEndpoint as BaseEndpoint
from sentry.coreapi import APIUnauthorized
from sentry.mediators.sentry_app_installations import Authorizer
from sentry.api.serializers.models.apitoken import ApiTokenSerializer


class SentryAppAuthorizationsEndpoint(BaseEndpoint):
    def post(self, request, install):
        try:
            token = Authorizer.run(
                grant_type=request.json_body.get('grant_type'),
                code=request.json_body.get('code'),
                client_id=request.json_body.get('client_id'),
                user=request.user,
                install=install,
            )
        except APIUnauthorized:
            return Response({'error': 'Unauthorized'}, status=403)

        return Response(
            ApiTokenSerializer().serialize(
                token,
                {
                    'state': request.json_body.get('state'),
                    'application': None,
                },
                request.user,
            ),
            status=201
        )
