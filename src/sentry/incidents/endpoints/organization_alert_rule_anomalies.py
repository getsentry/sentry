from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.metric_alert_examples import MetricAlertExamples
from sentry.apidocs.parameters import GlobalParams, MetricAlertParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.incidents.endpoints.bases import OrganizationAlertRuleEndpoint
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.organization import Organization
from sentry.seer.anomaly_detection.get_historical_anomalies import (
    get_historical_anomaly_data_from_seer,
)
from sentry.seer.anomaly_detection.types import DetectAnomaliesResponse


@region_silo_endpoint
class OrganizationAlertRuleAnomaliesEndpoint(OrganizationAlertRuleEndpoint):
    owner = ApiOwner.ALERTS_NOTIFICATIONS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    @extend_schema(
        operation_id="Retrieve anomalies for a Metric Alert Rule",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, MetricAlertParams.METRIC_RULE_ID],
        responses={
            200: inline_sentry_response_serializer(
                "ListAlertRuleAnomalies", DetectAnomaliesResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=MetricAlertExamples.GET_METRIC_ALERT_ANOMALIES,
    )
    def get(self, request: Request, organization: Organization, alert_rule: AlertRule) -> Response:
        """
        Return a list of anomalies for a metric alert rule.
        """
        if not features.has("organizations:anomaly-detection-alerts", organization):
            raise ResourceDoesNotExist("Your organization does not have access to this feature.")

        # NOTE: this will break if we ever do more than one project per alert rule
        project = alert_rule.projects.first()
        start = request.GET.get("start", None)
        end = request.GET.get("end", None)

        if not project or start is None or end is None:
            return Response(
                "Unable to get historical anomaly data: missing required argument(s) project, start, and/or end",
                status=400,
            )

        anomalies = get_historical_anomaly_data_from_seer(alert_rule, project, start, end)
        # NOTE: returns None if there's a problem with the Seer response
        if anomalies is None:
            return Response("Unable to get historical anomaly data", status=400)
        # NOTE: returns empty list if there is not enough event data
        return self.paginate(
            request=request,
            queryset=anomalies,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
