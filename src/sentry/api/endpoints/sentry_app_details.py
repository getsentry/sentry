from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.sentryapps import SentryAppDetailsEndpoint as BaseEndpoint
from sentry.api.serializers import serialize
from sentry.constants import SentryAppStatus
from sentry.features.helpers import requires_feature


class SentryAppDetailsEndpoint(BaseEndpoint):

    @requires_feature('organizations:internal-catchall', any_org=True)
    def get(self, request, sentry_app):
        # Superusers have access to the app, published or unpublished. Other
        # users only have access to a published app (for now)
        if request.user.is_superuser or sentry_app.status == SentryAppStatus.PUBLISHED:
            return Response(serialize(sentry_app, request.user))

        return Response(status=404)
