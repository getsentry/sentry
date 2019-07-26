from __future__ import absolute_import

from rest_framework.response import Response
from rest_framework import status

from sentry.api.bases import (
    OrganizationEndpoint, SentryAppBaseEndpoint, add_integration_platform_metric_tag,
)
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.coreapi import APIError
from sentry.mediators import sentry_app_components
from sentry.models import Project, SentryAppComponent, SentryAppInstallation
from sentry.features.helpers import requires_feature
from sentry.mediators.sentry_app_installation_tokenss import Creator


class SentryInternalAppTokensEndpoint(SentryAppBaseEndpoint):

    @requires_feature('organizations:sentry-apps', any_org=True)
    def post(self, request, sentry_app):
        # TODO: add permissions
        if not sentry_app.is_internal:
            return Response('Token generation on this route is limited to internal integrations only',
                status=status.HTTP_403_FORBIDDEN
            )

        sentry_app_installation = SentryAppInstallation.objects.get(sentry_app=sentry_app)

        # TODO: Check token limit

        data = {
            'sentry_app_installation': sentry_app_installation,
            'user': request.user
        }

        sentry_app_installation_token = Creator.run(request=request, **data)
        return Response(serialize(sentry_app_installation_token), status=201)
