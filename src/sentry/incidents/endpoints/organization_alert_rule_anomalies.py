from datetime import datetime

import orjson
import requests
from django.conf import settings
from drf_spectacular.utils import extend_schema
from pydantic import BaseModel
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.serializers.rest_framework.base import convert_dict_key_case, snake_to_camel_case
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.metric_alert_examples import MetricAlertExamples
from sentry.apidocs.parameters import GlobalParams, MetricAlertParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.incidents.endpoints.bases import OrganizationAlertRuleEndpoint
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.organization import Organization
from sentry.seer.anomaly_detection.detect_anomalies import get_anomaly_data_from_seer
from sentry.seer.anomaly_detection.types import AlertInSeer, TimeSeriesPoint
from sentry.seer.signed_seer_api import make_signed_seer_api_request, sign_with_seer_secret


class DetectAnomaliesResponse(BaseModel):
    timeseries: list[TimeSeriesPoint]


@region_silo_endpoint
class OrganizationAlertRuleAnomaliesEndpoint(OrganizationAlertRuleEndpoint):
    owner = ApiOwner.ALERTS_NOTIFICATIONS
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve anomalies for a Metric Alert Rule",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, MetricAlertParams.METRIC_RULE_ID],
        responses={
            200: inline_sentry_response_serializer(
                "ListAlertRuleAnomalies", DetectAnomaliesResponse
            ),
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
        start = request.GET.get("start", None)
        end = request.GET.get("end", None)
        anomalies = get_anomaly_data_from_seer("foobar")

        return Response(convert_dict_key_case(anomalies.dict(), snake_to_camel_case), status=200)
