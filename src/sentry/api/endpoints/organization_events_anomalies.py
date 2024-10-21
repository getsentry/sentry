from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationAlertRulePermission
from sentry.api.bases.organization_events import OrganizationEventsV2EndpointBase
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
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
from sentry.seer.anomaly_detection.get_historical_anomalies import (
    get_historical_anomaly_data_from_seer_preview,
)
from sentry.seer.anomaly_detection.types import DetectAnomaliesResponse, TimeSeriesPoint


@region_silo_endpoint
class OrganizationEventsAnomaliesEndpoint(OrganizationEventsV2EndpointBase):
    owner = ApiOwner.ALERTS_NOTIFICATIONS
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationAlertRulePermission,)

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
            ts_point = TimeSeriesPoint(timestamp=datum[0], value=datum[1].get("count", 0))
            formatted_data.append(ts_point)
        return formatted_data

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Return a list of anomalies for a time series of historical event data.
        """
        if not features.has(
            "organizations:anomaly-detection-alerts", organization
        ) and not features.has("organizations:anomaly-detection-rollout", organization):
            raise ResourceDoesNotExist("Your organization does not have access to this feature.")

        historical_data = self._format_historical_data(request.data.get("historical_data"))
        current_data = self._format_historical_data(request.data.get("current_data"))

        config = request.data.get("config")
        project_id = request.data.get("project_id")

        if project_id is None or not config or not historical_data or not current_data:
            return Response(
                "Unable to get historical anomaly data: missing required argument(s) project_id, config, historical_data, and/or current_data",
                status=400,
            )

        anomalies = get_historical_anomaly_data_from_seer_preview(
            current_data=current_data,
            historical_data=historical_data,
            project_id=project_id,
            organization_id=organization.id,
            config=config,
        )
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
