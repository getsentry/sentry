from __future__ import absolute_import

from rest_framework.response import Response

from api.bases.sentryapps import SentryAppInstallationDetailsEndpoint as BaseEndpoint
from sentry.api.serializers import serialize
from sentry.features.helpers import requires_feature
from sentry.mediators.sentry_app_installation import Destroyer


class OrganizationSentryAppInstallationDetailsEndpoint(BaseEndpoint):
    @requires_feature('organizations:internal-catchall')
    def get(self, request, organization, install):
        if install.organization == organization:
            return Response(serialize(install))

        return Response(status=404)

    @requires_feature('organizations:internal-catchall')
    def delete(self, request, organization, install):
        if not install.organization == organization:
            return Response(status=404)

        Destroyer.run(install)
        return Response(status=200)
