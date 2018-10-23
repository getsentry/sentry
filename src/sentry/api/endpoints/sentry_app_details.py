from __future__ import absolute_import

from rest_framework.response import Response
from sentry.api.bases.sentryapps import SentryAppDetailsEndpoint as BaseEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import SentryAppSerializer
from sentry.constants import SentryAppStatus
from sentry.features.helpers import requires_feature
from sentry.mediators.sentry_apps import Updater


class SentryAppDetailsEndpoint(BaseEndpoint):
    @requires_feature('organizations:internal-catchall', any_org=True)
    def get(self, request, sentry_app):
        # Superusers have access to the app, published or unpublished. Other
        # users only have access to a published app (for now)
        if request.user.is_superuser or sentry_app.status == SentryAppStatus.PUBLISHED:
            return Response(serialize(sentry_app, request.user))

        return Response(status=404)

    @requires_feature('organizations:internal-catchall', any_org=True)
    def put(self, request, sentry_app):
        serializer = SentryAppSerializer(data=request.DATA, partial=True)
        if serializer.is_valid():
            result = serializer.object
            updated_app = Updater.run(
                sentry_app=sentry_app,
                name=result.get('name'),
                webhook_url=result.get('webhook_url'),
                scopes=result.get('scopes'),
            )
            return Response(serialize(updated_app, request.user))

        return Response(serializer.errors, status=400)
