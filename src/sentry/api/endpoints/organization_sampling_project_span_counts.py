from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.utils import get_date_range_from_params
from sentry.constants import ObjectStatus
from sentry.dynamic_sampling.per_org.queries import get_eap_span_counts_by_root_project
from sentry.models.organization import Organization
from sentry.models.project import Project


@cell_silo_endpoint
class OrganizationSamplingProjectSpanCountsEndpoint(OrganizationEndpoint):
    """Received span counts of an organization, grouped by the project that started
    the trace and the project that owns the span."""

    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (OrganizationPermission,)
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:dynamic-sampling-custom", organization, actor=request.user
        ):
            raise ResourceDoesNotExist

        start, end = get_date_range_from_params(request.GET)
        # We are purposely not filtering on team membership, as all users should be able to see the span counts
        # in order to show the dynamic sampling settings page with all valid data. Please do not remove this
        # without consulting the owner of the endpoint
        projects = list(
            Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE)
        )
        slugs_by_id = {project.id: project.slug for project in projects}

        span_counts = get_eap_span_counts_by_root_project(
            organization,
            projects,
            start=start,
            end=end,
            environments=self.get_environments(request, organization),
        )
        rows = [
            {
                "by": {
                    "project": slugs_by_id[span_count.root_project_id],
                    "target_project_id": str(span_count.project_id),
                },
                "totals": span_count.count,
            }
            for span_count in span_counts
            if span_count.root_project_id in slugs_by_id and span_count.project_id in slugs_by_id
        ]

        return Response(status=200, data={"data": [rows], "start": start, "end": end})
