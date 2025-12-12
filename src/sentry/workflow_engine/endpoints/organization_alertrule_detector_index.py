from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
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
from sentry.incidents.endpoints.serializers.utils import get_object_id_from_fake_id
from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.serializers.alertrule_detector_serializer import (
    AlertRuleDetectorSerializer,
)
from sentry.workflow_engine.endpoints.validators.alertrule_detector import (
    AlertRuleDetectorValidator,
)
from sentry.workflow_engine.models.alertrule_detector import AlertRuleDetector
from sentry.workflow_engine.models.detector import Detector


@region_silo_endpoint
class OrganizationAlertRuleDetectorIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (OrganizationDetectorPermission,)

    @extend_schema(
        operation_id="Fetch Dual-Written Rule/Alert Rules and Detectors",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            200: AlertRuleDetectorSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Returns a dual-written rule/alert rule and its associated detector.
        """
        validator = AlertRuleDetectorValidator(data=request.query_params)
        validator.is_valid(raise_exception=True)
        rule_id = validator.validated_data.get("rule_id")
        alert_rule_id = validator.validated_data.get("alert_rule_id")
        detector_id = validator.validated_data.get("detector_id")

        queryset = AlertRuleDetector.objects.filter(detector__project__organization=organization)

        if detector_id:
            queryset = queryset.filter(detector_id=detector_id)

        if alert_rule_id:
            queryset = queryset.filter(alert_rule_id=alert_rule_id)

        if rule_id:
            queryset = queryset.filter(rule_id=rule_id)

        alert_rule_detector = queryset.first()

        if alert_rule_detector:
            return Response(serialize(alert_rule_detector, request.user))

        # Fallback: if alert_rule_id was provided but no AlertRuleDetector was found,
        # try looking up Detector directly using calculated detector_id
        if alert_rule_id:
            try:
                calculated_detector_id = get_object_id_from_fake_id(int(alert_rule_id))
                detector = Detector.objects.with_type_filters().get(
                    id=calculated_detector_id, project__organization=organization
                )

                if detector:
                    return Response(
                        {
                            "detectorId": str(detector.id),
                            "alertRuleId": str(alert_rule_id),
                            "ruleId": None,
                        }
                    )
            except (ValueError, Detector.DoesNotExist):
                pass

        raise ResourceDoesNotExist
