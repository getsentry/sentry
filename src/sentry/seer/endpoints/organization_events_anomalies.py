from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationAlertRulePermission
from sentry.api.bases.organization_events import OrganizationEventsEndpointBase
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers.base import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.organization_examples import OrganizationExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.organizations.services.organization import RpcOrganization, RpcUserOrganizationContext
from sentry.seer.anomaly_detection.get_historical_anomalies import (
    get_historical_anomaly_data_from_seer_preview,
)
from sentry.seer.anomaly_detection.types import DetectAnomaliesResponse, TimeSeriesPoint
from sentry.workflow_engine.endpoints.utils.ids import to_valid_int_id


@cell_silo_endpoint
class OrganizationEventsAnomaliesEndpoint(OrganizationEventsEndpointBase):
    owner = ApiOwner.ALERTS_NOTIFICATIONS
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    allow_any_team_alert_write_fallback = True
    # TODO(api-write-scope-compat): Remove legacy org:* support once alert
    # authoring preview clients have migrated to alerts:write.
    legacy_alert_mutation_scope_map = {
        "POST": ("org:read", "org:write", "org:admin"),
    }
    # This POST previews anomaly-detection config used while authoring metric
    # alerts/detectors, so it intentionally follows alert-write permissions.
    permission_classes = (OrganizationAlertRulePermission,)

    def get_alert_mutation_projects(
        self,
        request: Request,
        organization: Organization | RpcOrganization | RpcUserOrganizationContext,
    ):
        raw_project_id = request.data.get("project_id")
        if raw_project_id is None:
            return None

        try:
            project_id = to_valid_int_id("project_id", raw_project_id)
        except ValidationError:
            return None

        lookup_organization = (
            organization.organization
            if isinstance(organization, RpcUserOrganizationContext)
            else organization
        )
        return self.get_projects(request, lookup_organization, project_ids={project_id})

    @extend_schema(
        operation_id="Identify anomalies in historical data",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        responses={
            200: inline_sentry_response_serializer(
                "ListAlertRuleAnomalies", DetectAnomaliesResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=OrganizationExamples.GET_HISTORICAL_ANOMALIES,
    )
    def _format_historical_data(self, data) -> list[TimeSeriesPoint] | None:
        """
        Format EventsStatsData into the format that the Seer API expects.
        EventsStatsData is a list of lists with this format:
            [epoch timestamp, {'count': count}]
        Convert the data to this format:
            list[TimeSeriesPoint]
        """
        if data is None:
            return data

        formatted_data: list[TimeSeriesPoint] = []
        for datum in data:
            count = datum[1].get("count", 0)
            ts_point = TimeSeriesPoint(timestamp=datum[0], value=0 if count is None else count)
            formatted_data.append(ts_point)
        return formatted_data

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Return a list of anomalies for a time series of historical event data.
        """
        if not features.has("organizations:anomaly-detection-alerts", organization):
            raise ResourceDoesNotExist("Your organization does not have access to this feature.")

        historical_data = self._format_historical_data(request.data.get("historical_data"))
        current_data = self._format_historical_data(request.data.get("current_data"))

        config = request.data.get("config")
        raw_project_id = request.data.get("project_id")

        if raw_project_id is None or not config or not historical_data or not current_data:
            return Response(
                {
                    "detail": "Unable to get historical anomaly data: missing required argument(s) project_id, config, historical_data, and/or current_data"
                },
                status=400,
            )

        project_id = to_valid_int_id("project_id", raw_project_id)
        self.get_projects(request, organization, project_ids={project_id})

        anomalies = get_historical_anomaly_data_from_seer_preview(
            current_data=current_data,
            historical_data=historical_data,
            project_id=project_id,
            organization_id=organization.id,
            config=config,
        )
        # NOTE: returns None if there's a problem with the Seer response
        if anomalies is None:
            return Response({"detail": "Unable to get historical anomaly data"}, status=400)
        # NOTE: returns empty list if there is not enough event data
        return Response(serialize(anomalies, request.user))
