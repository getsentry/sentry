import logging

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.utils import to_valid_int_id
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import DetectorParams, GlobalParams
from sentry.models.organization import Organization
from sentry.seer.anomaly_detection.get_anomaly_data import get_anomaly_threshold_data_from_seer
from sentry.snuba.models import QuerySubscription
from sentry.workflow_engine.models import Detector

logger = logging.getLogger(__name__)


class SubscriptionNotFound(Exception):
    """Raised when a QuerySubscription cannot be found."""

    pass


@extend_schema(tags=["Workflows"])
@cell_silo_endpoint
class OrganizationDetectorAnomalyDataEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def _get_subscription_from_detector(
        self, detector_id: str, organization: Organization
    ) -> QuerySubscription:
        """Look up QuerySubscription from a detector ID."""
        validated_detector_id = to_valid_int_id("detector_id", detector_id, raise_404=True)
        try:
            detector = Detector.objects.with_type_filters().get(
                id=validated_detector_id, project__organization=organization
            )
        except Detector.DoesNotExist:
            raise ResourceDoesNotExist

        data_source = detector.data_sources.first()
        if not data_source:
            raise SubscriptionNotFound

        try:
            return QuerySubscription.objects.select_related("project").get(
                id=int(data_source.source_id)
            )
        except ValueError:
            raise SubscriptionNotFound

    @extend_schema(
        operation_id="Retrieve Anomaly Detection Threshold Data for a Detector",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, DetectorParams.DETECTOR_ID],
        responses={
            200: object,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization, detector_id: str) -> Response:
        """
        Return anomaly detection threshold data (yhat_lower, yhat_upper) for a detector.
        """
        start = request.GET.get("start")
        end = request.GET.get("end")

        if not start or not end:
            return Response({"detail": "start and end parameters are required"}, status=400)

        try:
            start_float = float(start)
            end_float = float(end)
        except ValueError:
            return Response({"detail": "start and end must be valid timestamps"}, status=400)

        logger.info(
            "anomaly_data.request",
            extra={
                "detector_id": detector_id,
                "start": start_float,
                "end": end_float,
                "organization_id": organization.id,
            },
        )

        try:
            query_subscription = self._get_subscription_from_detector(detector_id, organization)
        except (QuerySubscription.DoesNotExist, SubscriptionNotFound):
            return Response(
                {"detail": "Could not find query subscription for detector"},
                status=404,
            )

        if not request.access.has_project_access(query_subscription.project):
            raise PermissionDenied

        data = get_anomaly_threshold_data_from_seer(
            subscription=query_subscription, start=start_float, end=end_float
        )

        if data is None:
            logger.warning(
                "anomaly_data.seer_returned_none",
                extra={
                    "subscription_id": query_subscription.id,
                },
            )
            return Response(
                {"detail": "Unable to fetch anomaly detection threshold data"}, status=400
            )

        logger.info(
            "anomaly_data.success",
            extra={
                "subscription_id": query_subscription.id,
                "data_points_count": len(data),
            },
        )

        return Response({"data": data}, status=200)
