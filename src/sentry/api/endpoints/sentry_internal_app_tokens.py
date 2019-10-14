from __future__ import absolute_import

from rest_framework.response import Response
from rest_framework import status

from sentry.api.bases import SentryInternalAppTokenPermission, SentryAppBaseEndpoint
from sentry.models import ApiToken, SentryAppInstallation
from sentry.models.sentryapp import MASKED_VALUE
from sentry.mediators.sentry_app_installation_tokens import Creator
from sentry.api.serializers.models.apitoken import ApiTokenSerializer
from sentry.exceptions import ApiTokenLimitError


class SentryInternalAppTokensEndpoint(SentryAppBaseEndpoint):
    permission_classes = (SentryInternalAppTokenPermission,)

    def get(self, request, sentry_app):
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

    def post(self, request, sentry_app):
        if not sentry_app.is_internal:
            return Response(
                "This route is limited to internal integrations only",
                status=status.HTTP_403_FORBIDDEN,
            )

        sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=sentry_app)
        try:
            api_token = Creator.run(
                request=request, sentry_app_installation=sentry_app_installation, user=request.user
            )
        except ApiTokenLimitError as e:
            return Response(e.message, status=status.HTTP_403_FORBIDDEN)

        # hack so the token is included in the response
        attrs = {"application": None}
        token = ApiTokenSerializer().serialize(api_token, attrs, request.user)

        if not sentry_app.show_auth_info(request.access):
            token["token"] = MASKED_VALUE
            token["refreshToken"] = MASKED_VALUE

        return Response(token, status=201)
