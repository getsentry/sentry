import logging
from typing import Any

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.permissions import SentryPermission
from sentry.api.serializers import serialize
from sentry.integrations.api.bases.integration import PARANOID_GET
from sentry.integrations.models.integration_feature import Feature, IntegrationFeature

logger = logging.getLogger(__name__)


class IntegrationFeaturesPermissions(SentryPermission):
    scope_map = {"GET": PARANOID_GET}


@control_silo_endpoint
class IntegrationFeaturesEndpoint(Endpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (IntegrationFeaturesPermissions,)

    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return self.respond(
            [
                serialize(IntegrationFeature(feature=feature), request.user, has_target=False)
                for feature, _ in Feature.as_choices()
            ],
            status=status.HTTP_200_OK,
        )
