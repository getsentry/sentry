from __future__ import absolute_import

from django.http import Http404
from rest_framework.response import Response
from rest_framework import status

from sentry.api.bases import (
    SentryInternalAppTokenPermission, IntegrationPlatformEndpoint,
)
from sentry.api.serializers import serialize
from sentry.mediators import sentry_app_components
from sentry.models import Project, SentryAppInstallation, SentryAppInstallationToken
from sentry.features.helpers import requires_feature
from sentry.mediators.sentry_app_installation_tokens import Creator
from sentry.constants import INTERNAL_INTEGRATION_TOKEN_COUNT_MAX


class SentryInternalAppTokensEndpoint(IntegrationPlatformEndpoint):
    permission_classes = (SentryInternalAppTokenPermission, )

    def convert_args(self, request, sentry_app_slug, *args, **kwargs):
        try:
            sentry_app = SentryApp.objects.get(
                slug=sentry_app_slug,
            )
        except SentryApp.DoesNotExist:
            raise Http404

        self.check_object_permissions(request, sentry_app)

        kwargs['sentry_app'] = sentry_app
        return (args, kwargs)

    @requires_feature('organizations:sentry-apps', any_org=True)
    def post(self, request, sentry_app):
        if not sentry_app.is_internal:
            return Response('Token generation on this route is limited to internal integrations only',
                status=status.HTTP_403_FORBIDDEN
            )

        sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=sentry_app)
        curr_count = len(SentryAppInstallationToken.objects.filter(sentry_app_installation=sentry_app_installation))

        # make sure we don't go over the limit
        if curr_count >= INTERNAL_INTEGRATION_TOKEN_COUNT_MAX:
            return Response('Cannot generate more than %d tokens for a single integration' % INTERNAL_INTEGRATION_TOKEN_COUNT_MAX,
            status=status.HTTP_403_FORBIDDEN)

        data = {
            'sentry_app_installation': sentry_app_installation,
            'user': request.user
        }

        sentry_app_installation_token = Creator.run(request=request, **data)
        return Response(serialize(sentry_app_installation_token), status=201)
