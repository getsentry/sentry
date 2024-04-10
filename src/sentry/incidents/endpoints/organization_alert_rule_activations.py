from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.serializers.models.alert_rule_activations import AlertRuleActivationsSerializer
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.metric_alert_examples import MetricAlertExamples
from sentry.apidocs.parameters import GlobalParams, MetricAlertParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.incidents.endpoints.bases import OrganizationAlertRuleEndpoint


@extend_schema(tags=["Alerts"])
@region_silo_endpoint
class OrganizationAlertRuleActivationsEndpoint(OrganizationAlertRuleEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve activations for an AlertRule",
        parameters=[GlobalParams.ORG_SLUG, MetricAlertParams.METRIC_RULE_ID],
        responses={
            200: inline_sentry_response_serializer(
                "ListAlertRuleActivations", list[AlertRuleActivationsSerializer]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=MetricAlertExamples.GET_METRIC_ALERT_RULE,
    )
    def get(self, request: Request, organization, alert_rule) -> Response:
        activations = alert_rule.activations.all()
        start = request.GET.get("start", None)
        end = request.GET.get("end", None)
        if start and end:
            activations = activations.filter(Q(date_added__gte=start) & Q(date_added__lte=end))
        return Response({"activations": activations}, status=202)
