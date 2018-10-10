from __future__ import absolute_import

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry import features
from sentry.api.base import Endpoint, SessionAuthentication
from sentry.api.serializers import serialize
from sentry.constants import SentryAppStatus
from sentry.models import SentryApp


class SentryAppDetailsEndpoint(Endpoint):
    authentication_classes = (SessionAuthentication, )
    permission_classes = (IsAuthenticated, )

    def get(self, request, sentry_app_id):
        if not any(features.has('organizations:internal-catchall', org)
                   for org in request.user.get_orgs()):
            return Response(status=404)

        try:
            sentry_app = SentryApp.objects.get(id=sentry_app_id)
        except SentryApp.DoesNotExist:
            return Response(status=404)

        # Superusers have access to the app, published or unpublished. Other
        # users only have access to a published app (for now)
        if request.user.is_superuser or sentry_app.status == SentryAppStatus.PUBLISHED:
            return Response(serialize(sentry_app, request.user))

        return Response(status=404)
