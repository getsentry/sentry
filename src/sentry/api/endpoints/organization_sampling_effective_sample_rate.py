from datetime import timedelta
from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationAndStaffPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs.constants import RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.per_org.queries import get_eap_organization_volume
from sentry.dynamic_sampling.tasks.common import get_effective_sample_rate, get_organization_volume
from sentry.models.organization import Organization
from sentry.models.project import Project

SAMPLE_RATE_WINDOW = timedelta(hours=24)


class OrganizationSamplingEffectiveSampleRateResponse(TypedDict):
    effectiveSampleRate: float | None
    eapEffectiveSampleRate: float | None


@cell_silo_endpoint
class OrganizationSamplingEffectiveSampleRateEndpoint(OrganizationEndpoint):
    """Return the organization's effective sample rate over the last 24h.

    The effective sample rate is computed as indexed / total. It is returned from two sources,
    which do not have to agree:
    - effectiveSampleRate comes from the generic metrics counters, where total is the number of
      received segments and indexed is the number of segments with a keep decision. It measures
      the sampling decision alone.
    - eapEffectiveSampleRate comes from EAP, where total is the extrapolated number of received
      segments and indexed is the number of stored segments. Segments that dynamic sampling kept
      but that a quota or a pipeline drop removed later lower this rate.
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
    def get(
        self, request: Request, organization: Organization
    ) -> Response[OrganizationSamplingEffectiveSampleRateResponse]:
        if not features.has("organizations:dynamic-sampling", organization, actor=request.user):
            raise ResourceDoesNotExist

        projects = list(
            Project.objects.filter(organization_id=organization.id, status=ObjectStatus.ACTIVE)
        )
        eap_volume = get_eap_organization_volume(
            organization, projects, time_interval=SAMPLE_RATE_WINDOW
        )
        generic_metrics_volume = get_organization_volume(
            organization.id, time_interval=SAMPLE_RATE_WINDOW
        )

        return Response(
            status=200,
            data={
                "effectiveSampleRate": get_effective_sample_rate(generic_metrics_volume),
                "eapEffectiveSampleRate": get_effective_sample_rate(eap_volume),
            },
        )
