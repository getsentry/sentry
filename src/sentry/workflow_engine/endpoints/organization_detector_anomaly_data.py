from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import DetectorParams, GlobalParams
from sentry.models.organization import Organization
from sentry.seer.anomaly_detection.get_anomaly_data import get_anomaly_threshold_data_from_seer
from sentry.snuba.models import QuerySubscription
from sentry.workflow_engine.models import DataSourceDetector, Detector


@extend_schema(tags=["Workflows"])
@region_silo_endpoint
class OrganizationDetectorAnomalyDataEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

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
        if not features.has(
            "organizations:anomaly-detection-threshold-data", organization, actor=request.user
        ):
            raise ResourceDoesNotExist

        try:
            detector = Detector.objects.get(id=int(detector_id), project__organization=organization)
        except (Detector.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

        start = request.GET.get("start")
        end = request.GET.get("end")

        if not start or not end:
            return Response({"detail": "start and end parameters are required"}, status=400)

        try:
            start_float = float(start)
            end_float = float(end)
        except ValueError:
            return Response({"detail": "start and end must be valid timestamps"}, status=400)

        data_source_detector = DataSourceDetector.objects.filter(detector_id=detector.id).first()
        if not data_source_detector:
            return Response(
                {"detail": "Could not find detector, data source not found"}, status=500
            )
        data_source = data_source_detector.data_source

        try:
            query_subscription = QuerySubscription.objects.get(id=int(data_source.source_id))
        except QuerySubscription.DoesNotExist:
            return Response(
                {
                    "detail": f"Could not find detector, query subscription {data_source.source_id} not found"
                },
                status=500,
            )

        data = get_anomaly_threshold_data_from_seer(
            subscription=query_subscription, start=start_float, end=end_float
        )

        if data is None:
            return Response(
                {"detail": "Unable to fetch anomaly detection threshold data"}, status=400
            )

        return Response({"data": data}, status=200)
