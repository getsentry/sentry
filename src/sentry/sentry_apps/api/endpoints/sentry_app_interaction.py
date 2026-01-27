import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import StatsMixin, control_silo_endpoint
from sentry.sentry_apps.api.bases.sentryapps import (
    RegionSentryAppBaseEndpoint,
    SentryAppStatsPermission,
)
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.region import sentry_app_region_service

logger = logging.getLogger(__name__)


@control_silo_endpoint
class SentryAppInteractionEndpoint(RegionSentryAppBaseEndpoint, StatsMixin):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (SentryAppStatsPermission,)

    def get(self, request: Request, sentry_app) -> Response:
        """
        :qparam float since
        :qparam float until
        :qparam resolution - optional
        """
        args = self._parse_args(request)

        components = app_service.find_app_components(app_id=sentry_app.id)
        component_types = [component.type for component in components]

        result = sentry_app_region_service.get_interaction_stats(
            sentry_app=sentry_app,
            component_types=component_types,
            since=args["start"].timestamp(),
            until=args["end"].timestamp(),
            resolution=args.get("rollup"),
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        # Convert RpcTimeSeriesPoint to tuple format for API response
        views = [(point.time, point.count) for point in result.views]
        component_interactions = {
            key: [(point.time, point.count) for point in points]
            for key, points in result.component_interactions.items()
        }

        return Response({"views": views, "componentInteractions": component_interactions})

    def post(self, request: Request, sentry_app) -> Response:
        """
        Increment a TSDB metric relating to Sentry App interactions

        :param string tsdbField         the name of the TSDB model to increment
        :param string componentType     required for 'sentry_app_component_interacted' metric
        """
        tsdb_field = request.data.get("tsdbField", "")
        component_type = request.data.get("componentType")

        result = sentry_app_region_service.record_interaction(
            sentry_app=sentry_app,
            tsdb_field=tsdb_field,
            component_type=component_type,
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        return Response({}, status=201)
