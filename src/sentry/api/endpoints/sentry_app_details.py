from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.api.bases.sentryapps import SentryAppBaseEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import SentryAppSerializer
from sentry.mediators.sentry_apps import Updater


class SentryAppDetailsEndpoint(SentryAppBaseEndpoint):
    def get(self, request, sentry_app):
        if not features.has('organizations:internal-catchall', sentry_app.owner):
            return Response(status=404)

        return Response(serialize(sentry_app, request.user))

    def put(self, request, sentry_app):
        if not features.has('organizations:internal-catchall', sentry_app.owner):
            return Response(status=404)

        serializer = SentryAppSerializer(data=request.DATA, partial=True)

        if serializer.is_valid():
            result = serializer.object

            updated_app = Updater.run(
                sentry_app=sentry_app,
                name=result.get('name'),
                webhook_url=result.get('webhookUrl'),
                redirect_url=result.get('redirectUrl'),
                scopes=result.get('scopes'),
                overview=result.get('overview'),
            )

            return Response(serialize(updated_app, request.user))

        return Response(serializer.errors, status=400)
