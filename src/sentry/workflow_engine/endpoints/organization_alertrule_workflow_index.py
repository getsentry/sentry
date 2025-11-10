from drf_spectacular.utils import extend_schema
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationDetectorPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.workflow_engine.endpoints.serializers.alertrule_workflow_serializer import (
    AlertRuleWorkflowSerializer,
)
from sentry.workflow_engine.endpoints.validators.alertrule_workflow import (
    AlertRuleWorkflowValidator,
)
from sentry.workflow_engine.models.alertrule_workflow import AlertRuleWorkflow


@region_silo_endpoint
class OrganizationAlertRuleWorkflowIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (OrganizationDetectorPermission,)

    @extend_schema(
        operation_id="Fetch Dual-Written Rule/Alert Rules and Workflows",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            200: AlertRuleWorkflowSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request, organization):
        """
        Returns a dual-written rule/alert rule and its associated workflow.
        """
        validator = AlertRuleWorkflowValidator(data=request.query_params)
        validator.is_valid(raise_exception=True)
        rule_id = validator.validated_data.get("rule_id")
        alert_rule_id = validator.validated_data.get("alert_rule_id")
        workflow_id = validator.validated_data.get("workflow_id")

        queryset = AlertRuleWorkflow.objects.filter(workflow__organization=organization)

        if workflow_id:
            queryset = queryset.filter(workflow_id=workflow_id)

        if alert_rule_id:
            queryset = queryset.filter(alert_rule_id=alert_rule_id)

        if rule_id:
            queryset = queryset.filter(rule_id=rule_id)

        alert_rule_workflow = queryset.first()
        if not alert_rule_workflow:
            raise ResourceDoesNotExist

        return Response(serialize(alert_rule_workflow, request.user))
