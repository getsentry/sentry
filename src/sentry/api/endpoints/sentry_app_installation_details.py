from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import SentryAppInstallationBaseEndpoint
from sentry.api.serializers import serialize
from sentry.mediators.sentry_app_installations import Destroyer


class SentryAppInstallationDetailsEndpoint(SentryAppInstallationBaseEndpoint):
    def get(self, request, installation):

        return Response(serialize(installation))

    def delete(self, request, installation):
        Destroyer.run(
            install=installation,
            user=request.user,
            request=request,
        )
        return Response(status=204)
