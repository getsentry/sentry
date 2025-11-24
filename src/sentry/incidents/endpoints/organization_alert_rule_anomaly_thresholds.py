from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.renderers import JSONRenderer
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, MetricAlertParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.incidents.endpoints.bases import OrganizationAlertRuleEndpoint
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.organization import Organization
from sentry.seer.anomaly_detection.get_alert_threshold_data import (
    get_alert_threshold_data_from_seer,
)
from sentry.seer.anomaly_detection.types import GetAlertThresholdDataResponse


class AlertRuleAnomalyThresholdsQueryParamsSerializer(serializers.Serializer):
    start = serializers.FloatField(
        required=True,
        help_text="Start timestamp (epoch seconds) for fetching threshold data",
    )
    end = serializers.FloatField(
        required=True,
        help_text="End timestamp (epoch seconds) for fetching threshold data",
    )


@region_silo_endpoint
class OrganizationAlertRuleAnomalyThresholdsEndpoint(OrganizationAlertRuleEndpoint):
    """
    Fetch anomaly detection threshold bounds (yhat_lower, yhat_upper) for a metric alert rule.

    Used to display threshold lines on anomaly detection graphs.
    """

    owner = ApiOwner.ALERTS_NOTIFICATIONS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    renderer_classes = (JSONRenderer,)

    @extend_schema(
        operation_id="Get Anomaly Detection Thresholds for Alert Rule",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            MetricAlertParams.METRIC_RULE_ID,
            AlertRuleAnomalyThresholdsQueryParamsSerializer,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "AlertThresholdDataResponse", GetAlertThresholdDataResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization, alert_rule: AlertRule) -> Response:
        """
        Get anomaly detection threshold data (yhat_lower, yhat_upper) for an alert rule.

        Returns threshold bounds from Seer's ML model that determine when a data point
        is considered anomalous. Used to visualize thresholds on metric alert charts.
        """
        if not features.has("organizations:anomaly-detection-alerts", organization):
            raise ResourceDoesNotExist("Your organization does not have access to this feature.")

        serializer = AlertRuleAnomalyThresholdsQueryParamsSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        start = serializer.validated_data["start"]
        end = serializer.validated_data["end"]

        threshold_data = get_alert_threshold_data_from_seer(
            alert_rule=alert_rule,
            start=start,
            end=end,
        )

        if threshold_data is None:
            return Response(
                {"detail": "Unable to fetch threshold data from Seer"},
                status=400,
            )

        return Response(serialize(threshold_data, request.user))
