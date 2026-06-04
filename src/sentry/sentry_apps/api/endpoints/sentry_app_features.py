from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import SentryAppParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.integrations.api.serializers.models.integration_feature import (
    IntegrationFeatureResponse,
    IntegrationFeatureSerializer,
)
from sentry.integrations.models.integration_feature import IntegrationFeature, IntegrationTypes
from sentry.sentry_apps.api.bases.sentryapps import SentryAppBaseEndpoint


@extend_schema(tags=["Integration"])
@control_silo_endpoint
class SentryAppFeaturesEndpoint(SentryAppBaseEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="List a Custom Integration's Features",
        parameters=[SentryAppParams.SENTRY_APP_ID_OR_SLUG],
        responses={
            200: inline_sentry_response_serializer(
                "ListSentryAppFeatures", list[IntegrationFeatureResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, sentry_app) -> Response[list[IntegrationFeatureResponse]]:
        """
        Return the list of features that a custom integration (Sentry App) declares.
        """
        features = IntegrationFeature.objects.filter(
            target_id=sentry_app.id, target_type=IntegrationTypes.SENTRY_APP.value
        )

        return self.paginate(
            request=request,
            queryset=features,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, serializer=IntegrationFeatureSerializer()
            ),
        )
