from __future__ import absolute_import

from rest_framework.response import Response
from rest_framework import status
from django.http import Http404

from sentry.api.bases import (
    SentryInternalAppTokenPermission, IntegrationPlatformEndpoint,
)
from sentry.models import SentryApp, ApiToken
from sentry.features.helpers import requires_feature
# from sentry.mediators.sentry_app_installation_tokens import Creator


class SentryInternalAppTokenDetailEndpoint(IntegrationPlatformEndpoint):
    permission_classes = (SentryInternalAppTokenPermission, )

    def convert_args(self, request, sentry_app_slug, token, *args, **kwargs):
        try:
            sentry_app = SentryApp.objects.get(
                slug=sentry_app_slug,
            )
        except SentryApp.DoesNotExist:
            raise Http404

        self.check_object_permissions(request, sentry_app)

        kwargs['sentry_app'] = sentry_app

        kwargs['api_token'] = ApiToken.objects.get(token=token)

        return (args, kwargs)

    @requires_feature('organizations:sentry-apps', any_org=True)
    def delete(self, request, sentry_app, api_token):
        if not sentry_app.is_internal:
            return Response('Token generation on this route is limited to internal integrations only',
                status=status.HTTP_403_FORBIDDEN
            )

        # TODO: Call destroyer

        return Response(status=204)
