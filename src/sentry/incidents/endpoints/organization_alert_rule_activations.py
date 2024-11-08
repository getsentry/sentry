from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.metric_alert_examples import MetricAlertExamples
from sentry.apidocs.parameters import GlobalParams, MetricAlertParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.incidents.endpoints.bases import OrganizationAlertRuleEndpoint
from sentry.incidents.endpoints.serializers.alert_rule_activations import (
    AlertRuleActivationsResponse,
)
from sentry.incidents.models.alert_rule import AlertRule
from sentry.models.organization import Organization


@extend_schema(tags=["Alerts"])
@region_silo_endpoint
class OrganizationAlertRuleActivationsEndpoint(OrganizationAlertRuleEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Retrieve activations for a Metric Alert Rule",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, MetricAlertParams.METRIC_RULE_ID],
        responses={
            200: inline_sentry_response_serializer(
                "ListAlertRuleActivations", list[AlertRuleActivationsResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=MetricAlertExamples.GET_METRIC_ALERT_ACTIVATIONS,
    )
    def get(self, request: Request, organization: Organization, alert_rule: AlertRule) -> Response:
        """
        Return a list of activations for a metric alert rule.

        An activation represents a single instance of an activated alert rule being triggered.
        It contains a date_added field which represents the time the alert was triggered.
        Activations can be filtered by start and end parameters to return activations with date_added that falls within the specified time window.
        """
        activations = alert_rule.activations.all()
        start = request.GET.get("start", None)
        end = request.GET.get("end", None)
        if start and end:
            activations = activations.filter(Q(date_added__gte=start) & Q(date_added__lte=end))

        return self.paginate(
            request,
            queryset=activations,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
            default_per_page=25,
        )
