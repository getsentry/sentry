from typing import TypedDict

from django.db.models import Case, Count, IntegerField, When
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import DetectorParams, GlobalParams, OrganizationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.utils.auth import AuthenticatedHttpRequest
from sentry.workflow_engine.models import Detector


class DetectorCountResponse(TypedDict):
    active: int
    deactive: int
    total: int


@region_silo_endpoint
@extend_schema(tags=["Workflows"])
class OrganizationDetectorCountEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

    @extend_schema(
        operation_id="Get Organization Detector Count",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            DetectorParams.TYPE,
        ],
        responses={
            200: inline_sentry_response_serializer("DetectorCountResponse", DetectorCountResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
        },
    )
    def get(self, request: AuthenticatedHttpRequest, organization: Organization) -> Response:
        """
        Retrieves the count of detectors for an organization.
        """
        try:
            filter_params = self.get_filter_params(request, organization, date_filter_optional=True)
        except NoProjects:
            empty_response: DetectorCountResponse = {
                "active": 0,
                "deactive": 0,
                "total": 0,
            }
            return self.respond(empty_response)

        queryset = Detector.objects.with_type_filters().filter(
            status=ObjectStatus.ACTIVE,
            project__organization_id=organization.id,
            project_id__in=filter_params["project_id"],
        )

        # Filter by detector types if specified
        detector_types = request.GET.getlist("type")
        if detector_types:
            queryset = queryset.filter(type__in=detector_types)

        counts = queryset.aggregate(
            active=Count(
                Case(
                    When(enabled=True, then=1),
                    output_field=IntegerField(),
                )
            ),
            deactive=Count(
                Case(
                    When(enabled=False, then=1),
                    output_field=IntegerField(),
                )
            ),
            total=Count("id"),
        )

        response_data: DetectorCountResponse = {
            "active": counts["active"],
            "deactive": counts["deactive"],
            "total": counts["total"],
        }
        return self.respond(response_data)
