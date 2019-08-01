from __future__ import absolute_import

from rest_framework.response import Response
from rest_framework import status

from sentry.api.bases import (
    SentryInternalAppTokenPermission, SentryAppBaseEndpoint,
)
from sentry.models import SentryAppInstallation, SentryAppInstallationToken
from sentry.features.helpers import requires_feature
from sentry.mediators.sentry_app_installation_tokens import Creator
from sentry.constants import INTERNAL_INTEGRATION_TOKEN_COUNT_MAX
from sentry.api.serializers.models.apitoken import ApiTokenSerializer


class SentryInternalAppTokensEndpoint(SentryAppBaseEndpoint):
    permission_classes = (SentryInternalAppTokenPermission, )

    @requires_feature('organizations:sentry-apps', any_org=True)
    def post(self, request, sentry_app):
        if not sentry_app.is_internal:
            return Response('This route is limited to internal integrations only',
                            status=status.HTTP_403_FORBIDDEN
                            )

        sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=sentry_app)
        curr_count = len(SentryAppInstallationToken.objects.filter(
            sentry_app_installation=sentry_app_installation))

        # make sure we don't go over the limit
        if curr_count >= INTERNAL_INTEGRATION_TOKEN_COUNT_MAX:
            return Response('Cannot generate more than %d tokens for a single integration' % INTERNAL_INTEGRATION_TOKEN_COUNT_MAX,
                            status=status.HTTP_403_FORBIDDEN)

        data = {
            'sentry_app_installation': sentry_app_installation,
            'user': request.user
        }
        api_token = Creator.run(request=request, **data)

        # hack so the token is included in the response
        attrs = {
            'application': None,
        }
        return Response(ApiTokenSerializer().serialize(api_token, attrs, request.user), status=201)
