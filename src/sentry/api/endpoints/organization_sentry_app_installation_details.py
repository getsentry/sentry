from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.features.helpers import requires_feature
from sentry.mediators.sentry_app_installations import Destroyer
from sentry.models import SentryAppInstallation


class OrganizationSentryAppInstallationDetailsEndpoint(OrganizationEndpoint):
    @requires_feature('organizations:internal-catchall')
    def get(self, request, organization, uuid):
        try:
            install = SentryAppInstallation.objects.get(
                organization=organization,
                uuid=uuid,
            )
        except SentryAppInstallation.DoesNotExist:
            return Response(status=404)

        return Response(serialize(install))

    @requires_feature('organizations:internal-catchall')
    def delete(self, request, organization, uuid):
        try:
            install = SentryAppInstallation.objects.get(
                organization=organization,
                uuid=uuid,
            )
        except SentryAppInstallation.DoesNotExist:
            return Response(status=404)

        Destroyer.run(install=install)
        return Response(status=204)
