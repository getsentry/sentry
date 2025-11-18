from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams, MetricAlertParams
from sentry.incidents.endpoints.bases import OrganizationAlertRuleEndpoint
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.organization import Organization
from sentry.seer.anomaly_detection.get_anomaly_data import get_anomaly_threshold_data_from_seer


@extend_schema(tags=["Alerts"])
@region_silo_endpoint
class OrganizationAlertRuleAnomalyDataEndpoint(OrganizationAlertRuleEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="Retrieve Anomaly Detection Threshold Data for an Alert Rule",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, MetricAlertParams.METRIC_RULE_ID],
        responses={
            200: object,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization, alert_rule: AlertRule) -> Response:
        """
        Return anomaly detection threshold data (yhat_lower, yhat_upper) for a metric alert rule.
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

        subscription = alert_rule.snuba_query.subscriptions.first()
        if not subscription:
            return Response({"detail": "No subscription found for this alert rule"}, status=404)
        data = get_anomaly_threshold_data_from_seer(
            subscription=subscription, start=start_float, end=end_float
        )

        if data is None:
            return Response(
                {"detail": "Unable to fetch anomaly detection threshold data"}, status=400
            )

        return Response({"data": data}, status=200)
