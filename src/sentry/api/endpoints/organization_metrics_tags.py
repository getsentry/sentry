from collections.abc import Sequence

import sentry_sdk
from rest_framework.exceptions import NotFound, ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationAndStaffPermission, OrganizationEndpoint
from sentry.api.exceptions import BadRequest
from sentry.exceptions import InvalidParams
from sentry.models.organization import Organization
from sentry.sentry_metrics.querying.metadata.tags import get_tag_keys
from sentry.sentry_metrics.use_case_utils import get_use_case_id
from sentry.snuba.metrics import (
    DerivedMetricParseException,
    MetricDoesNotExistException,
    MetricDoesNotExistInIndexer,
    Tag,
    get_all_tags,
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

    def get(self, request: Request, organization: Organization) -> Response:
        metric_names = request.GET.getlist("metric") or []
        projects = self.get_projects(request, organization)
        if not projects:
            return Response(
                {"detail": "You must supply at least one project to see its metrics"}, status=404
            )

        if len(metric_names) != 1:
            raise BadRequest(message="Please provide a single metric to query its tags.")

        metric_name = metric_names[0]
        if not is_mri(metric_name):
            raise BadRequest(message="Please provide a valid MRI to query a metric's tags.")

        if all(
            features.has("projects:use-eap-spans-for-metrics-explorer", project)
            for project in projects
        ):
            if metric_name.startswith("d:eap"):
                # TODO: hack for EAP, return a fixed list
                return Response([Tag(key="color"), Tag(key="location")])

        try:
            if metric_name.startswith("e:"):
                # If metric_name starts with "e:", and therefore is a derived metric, use the old get_all_tags functionality
                # This branch should be deleted eventually.
                sentry_sdk.capture_message("organization_metrics_tags.non-mri-metric-name")
                formatted_tags: Sequence[Tag] = get_all_tags(
                    projects, [metric_name], use_case_id=get_use_case_id(request)
                )

            else:
                tags = get_tag_keys(
                    organization=organization,
                    projects=projects,
                    use_case_ids=[extract_use_case_id(metric_name)],
                    mri=metric_name,
                )
                tags.append("project")
                formatted_tags = [Tag(key=tag) for tag in set(tags)]

        except (InvalidParams, DerivedMetricParseException) as exc:
            raise (ParseError(detail=str(exc)))

        except (MetricDoesNotExistInIndexer, MetricDoesNotExistException):
            raise NotFound(f"The specified metric was not found: {metric_name}")

        return Response(formatted_tags, status=200)
