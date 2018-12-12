from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.api.bases import SentryAppInstallationBaseEndpoint
from sentry.api.serializers import serialize
from sentry.mediators.sentry_app_installations import Destroyer


class SentryAppInstallationDetailsEndpoint(SentryAppInstallationBaseEndpoint):
    def get(self, request, installation):
        if not features.has('organizations:internal-catchall',
                            installation.organization,
                            actor=request.user):
            return Response(status=404)

        return Response(serialize(installation))

    def delete(self, request, installation):
        if not features.has('organizations:internal-catchall',
                            installation.organization,
                            actor=request.user):
            return Response(status=404)

        Destroyer.run(install=installation)
        return Response(status=204)
