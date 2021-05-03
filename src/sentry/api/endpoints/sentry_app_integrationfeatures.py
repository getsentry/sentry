from rest_framework import status

from sentry.api.bases import SentryAppsBaseEndpoint
from sentry.api.permissions import SuperuserPermission
from sentry.models import Feature


class SentryAppIntegrationFeaturesEndpoint(SentryAppsBaseEndpoint):
    permission_classes = (SuperuserPermission,)

    def get(self, request):

        features = {feature: value for (value, feature) in Feature.as_choices()}

        return self.respond(features, status=status.HTTP_200_OK)
