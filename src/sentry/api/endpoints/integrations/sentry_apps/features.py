from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.sentryapps import SentryAppBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.integrations.integration_feature import IntegrationFeature, IntegrationTypes


@control_silo_endpoint
class SentryAppFeaturesEndpoint(SentryAppBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, sentry_app) -> Response:
        features = IntegrationFeature.objects.filter(
            target_id=sentry_app.id, target_type=IntegrationTypes.SENTRY_APP.value
        )

        return self.paginate(
            request=request,
            queryset=features,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
