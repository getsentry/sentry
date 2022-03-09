import logging
from typing import Any

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.bases.integration import PARANOID_GET
from sentry.api.permissions import SentryPermission
from sentry.api.serializers import serialize
from sentry.models import IntegrationFeature
from sentry.models.integrations.integration_feature import Feature

logger = logging.getLogger(__name__)


class IntegrationFeaturesPermissions(SentryPermission):
    scope_map = {"GET": PARANOID_GET}


class IntegrationFeaturesEndpoint(Endpoint):
    permission_classes = (IntegrationFeaturesPermissions,)

    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return self.respond(
            [
                serialize(IntegrationFeature(feature=feature), request.user, has_target=False)
                for feature, _ in Feature.as_choices()
            ],
            status=status.HTTP_200_OK,
        )
