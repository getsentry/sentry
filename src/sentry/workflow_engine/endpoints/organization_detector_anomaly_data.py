import logging

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
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.organization import Organization
from sentry.seer.anomaly_detection.get_anomaly_data import get_anomaly_threshold_data_from_seer
from sentry.snuba.models import QuerySubscription
from sentry.workflow_engine.models import Detector

logger = logging.getLogger(__name__)


class SubscriptionNotFound(Exception):
    """Raised when a QuerySubscription cannot be found."""

    pass


@extend_schema(tags=["Workflows"])
@region_silo_endpoint
class OrganizationDetectorAnomalyDataEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def _get_subscription_from_detector(
        self, detector_id: str, organization: Organization
    ) -> QuerySubscription:
        """Look up QuerySubscription from a detector ID."""
        try:
            detector = Detector.objects.with_type_filters().get(
                id=int(detector_id), project__organization=organization
            )
        except (Detector.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

        data_source = detector.data_sources.first()
        if not data_source:
            raise SubscriptionNotFound

        try:
            return QuerySubscription.objects.get(id=int(data_source.source_id))
        except ValueError:
            raise SubscriptionNotFound

    def _get_subscription_from_alert_rule(
        self, alert_rule_id: str, organization: Organization
    ) -> QuerySubscription:
        """Look up QuerySubscription from a legacy alert rule ID."""
        try:
            alert_rule = AlertRule.objects.get(id=int(alert_rule_id), organization=organization)
            logger.info(
                "anomaly_data.legacy_alert_found",
                extra={
                    "alert_rule_id": alert_rule_id,
                    "snuba_query_id": alert_rule.snuba_query_id,
                    "organization_id": organization.id,
                },
            )
        except (AlertRule.DoesNotExist, ValueError):
            logger.warning(
                "anomaly_data.legacy_alert_not_found",
                extra={"alert_rule_id": alert_rule_id, "organization_id": organization.id},
            )
            raise ResourceDoesNotExist

        subscription = QuerySubscription.objects.filter(
            snuba_query_id=alert_rule.snuba_query_id
        ).first()
        if not subscription:
            raise SubscriptionNotFound
        logger.info(
            "anomaly_data.subscription_found",
            extra={
                "alert_rule_id": alert_rule_id,
                "subscription_id": subscription.id,
            },
        )
        return subscription

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
        Return anomaly detection threshold data (yhat_lower, yhat_upper) for a detector
        or legacy alert rule.

        Pass `legacy_alert=true` query param to treat detector_id as a legacy alert rule ID.
        """
        if not features.has(
            "organizations:anomaly-detection-threshold-data", organization, actor=request.user
        ):
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

        is_legacy_alert = request.GET.get("legacy_alert", "").lower() == "true"

        logger.info(
            "anomaly_data.request",
            extra={
                "detector_id": detector_id,
                "is_legacy_alert": is_legacy_alert,
                "start": start_float,
                "end": end_float,
                "organization_id": organization.id,
            },
        )

        try:
            if is_legacy_alert:
                query_subscription = self._get_subscription_from_alert_rule(
                    detector_id, organization
                )
            else:
                query_subscription = self._get_subscription_from_detector(detector_id, organization)
        except (QuerySubscription.DoesNotExist, SubscriptionNotFound):
            model_type = "alert rule" if is_legacy_alert else "detector"
            return Response(
                {"detail": f"Could not find query subscription for {model_type}"},
                status=404,
            )

        data = get_anomaly_threshold_data_from_seer(
            subscription=query_subscription, start=start_float, end=end_float
        )

        if data is None:
            logger.warning(
                "anomaly_data.seer_returned_none",
                extra={
                    "subscription_id": query_subscription.id,
                    "is_legacy_alert": is_legacy_alert,
                },
            )
            return Response(
                {"detail": "Unable to fetch anomaly detection threshold data"}, status=400
            )

        logger.info(
            "anomaly_data.success",
            extra={
                "subscription_id": query_subscription.id,
                "is_legacy_alert": is_legacy_alert,
                "data_points_count": len(data),
            },
        )

        return Response({"data": data}, status=200)
