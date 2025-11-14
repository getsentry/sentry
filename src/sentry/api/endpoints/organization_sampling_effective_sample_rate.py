from datetime import timedelta
from typing import int, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationAndStaffPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs.constants import RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.dynamic_sampling.tasks.common import get_organization_volume
from sentry.models.organization import Organization


class OrganizationSamplingEffectiveSampleRateResponse(TypedDict):
    effectiveSampleRate: float | None


@region_silo_endpoint
class OrganizationSamplingEffectiveSampleRateEndpoint(OrganizationEndpoint):
    """Return the organization's effective sample rate over the last 24h.

    The effective sample rate is computed as indexed / total where:
    - total = total number of transactions received
    - indexed = number of transactions kept (indexed)
    """

    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (OrganizationAndStaffPermission,)
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="Retrieve an Organization's Effective Sample Rate (24h)",
        tags=["Organizations"],
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationSamplingEffectiveSampleRateResponse",
                OrganizationSamplingEffectiveSampleRateResponse,
            ),
            401: RESPONSE_UNAUTHORIZED,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:dynamic-sampling", organization, actor=request.user):
            raise ResourceDoesNotExist

        org_volume = get_organization_volume(organization.id, time_interval=timedelta(hours=24))
        rate: float | None
        if org_volume is not None and org_volume.indexed is not None and org_volume.total > 0:
            rate = org_volume.indexed / org_volume.total
        else:
            rate = None

        return Response(status=200, data={"effectiveSampleRate": rate})
