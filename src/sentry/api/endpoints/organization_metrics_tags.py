import sentry_sdk
from rest_framework.exceptions import NotFound, ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationAndStaffPermission, OrganizationEndpoint
from sentry.api.exceptions import BadRequest
from sentry.exceptions import InvalidParams
from sentry.sentry_metrics.querying.metadata.tags import get_tag_keys
from sentry.sentry_metrics.use_case_utils import get_use_case_id
from sentry.snuba.metrics import (
    DerivedMetricParseException,
    MetricDoesNotExistInIndexer,
    get_all_tags,
    get_mri,
)
from sentry.snuba.metrics.naming_layer.mri import extract_use_case_id, is_mri


@region_silo_endpoint
class OrganizationMetricsTagsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (OrganizationAndStaffPermission,)

    """Get list of tag names for this project
    The ``metric``query param must be provided and can only be a single metric name or MRI. Providing either
    no metric or more than one will produce an HTTP 400 error.
    """

    def get(self, request: Request, organization) -> Response:
        metric_names = request.GET.getlist("metric") or []
        projects = self.get_projects(request, organization)
        if not projects:
            raise InvalidParams("You must supply at least one project to see the tag names")

        if len(metric_names) != 1:
            raise BadRequest(message="Please provide a single metric to query its tags.")

        try:
            metric_name = metric_names[0]
            # If metric_name is a valid MRI, use the snuba meta table for tags.
            # If metric_name corresponds to some legacy type of metric, use the old get_all_tags functionality
            if is_mri(metric_name):
                tags = get_tag_keys(
                    organization=organization,
                    projects=projects,
                    use_case_ids=[extract_use_case_id(metric_name)],
                    mri=metric_name,
                )
                tags.append("project")
                formatted_tags = [{"key": tag} for tag in set(tags)]

            else:
                sentry_sdk.capture_message("organization_metrics_tags.non-mri-metric-name")
                mri = get_mri(metric_name)
                formatted_tags = get_all_tags(projects, [mri], use_case_id=get_use_case_id(request))

        except (InvalidParams, DerivedMetricParseException) as exc:
            raise (ParseError(detail=str(exc)))

        except MetricDoesNotExistInIndexer:
            raise NotFound(f"One of the specified metrics was not found: {metric_names}")

        return Response(formatted_tags, status=200)
