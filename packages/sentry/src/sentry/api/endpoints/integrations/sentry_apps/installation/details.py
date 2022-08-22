from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases import SentryAppInstallationBaseEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import SentryAppInstallationSerializer
from sentry.mediators.sentry_app_installations import Destroyer, Updater


class SentryAppInstallationDetailsEndpoint(SentryAppInstallationBaseEndpoint):
    def get(self, request: Request, installation) -> Response:

        return Response(serialize(installation))

    def delete(self, request: Request, installation) -> Response:
        Destroyer.run(install=installation, user=request.user, request=request)
        return Response(status=204)

    def put(self, request: Request, installation) -> Response:
        serializer = SentryAppInstallationSerializer(installation, data=request.data, partial=True)

        if serializer.is_valid():
            result = serializer.validated_data

            updated_installation = Updater.run(
                user=request.user, sentry_app_installation=installation, status=result.get("status")
            )

            return Response(serialize(updated_installation, request.user))
        return Response(serializer.errors, status=400)
