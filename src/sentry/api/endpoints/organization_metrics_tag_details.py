from rest_framework.exceptions import NotFound, ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.exceptions import InvalidParams
from sentry.models.organization import Organization
from sentry.sentry_metrics.querying.metadata import convert_metric_names_to_mris, get_tag_values
from sentry.sentry_metrics.use_case_utils import get_use_case_id
from sentry.snuba.metrics import DerivedMetricParseException


@region_silo_endpoint
class OrganizationMetricsTagDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    """Get all existing tag values for a metric"""

    def get(self, request: Request, organization: Organization, tag_name: str) -> Response:
        metric_names = request.GET.getlist("metric") or []
        tag_value_prefix = request.GET.get("prefix") or ""
        if len(metric_names) > 1:
            raise ParseError(
                "Please supply only a single metric name. Specifying multiple metric names is not supported for this endpoint."
            )
        projects = self.get_projects(request, organization)
        if not projects:
            return Response(
                {"detail": "You must supply at least one project to see its metrics"}, status=404
            )

        if all(
            features.has("projects:use-eap-spans-for-metrics-explorer", project)
            for project in projects
        ):
            if len(metric_names) == 1 and metric_names[0].startswith("d:eap"):
                # TODO: hack for EAP, hardcode some metric names
                if tag_name == "color":
                    return Response(
                        [
                            {"key": tag_name, "value": "red"},
                            {"key": tag_name, "value": "blue"},
                            {"key": tag_name, "value": "green"},
                        ]
                    )
                if tag_name == "location":
                    return Response(
                        [
                            {"key": tag_name, "value": "mobile"},
                            {"key": tag_name, "value": "frontend"},
                            {"key": tag_name, "value": "backend"},
                        ]
                    )
        try:
            mris = convert_metric_names_to_mris(metric_names)
            tag_values: set[str] = set()
            for mri in mris:
                mri_tag_values = get_tag_values(
                    organization=organization,
                    projects=projects,
                    use_case_ids=[get_use_case_id(request)],
                    mri=mri,
                    tag_key=tag_name,
                    tag_value_prefix=tag_value_prefix,
                )
                tag_values = tag_values.union(mri_tag_values)

        except InvalidParams:
            raise NotFound(self._generate_not_found_message(metric_names, tag_name))

        except DerivedMetricParseException as exc:
            raise ParseError(str(exc))

        tag_values_formatted = [{"key": tag_name, "value": tag_value} for tag_value in tag_values]

        if len(tag_values_formatted) > 0:
            return Response(tag_values_formatted, status=200)
        elif len(tag_values_formatted) == 0 and len(tag_value_prefix) > 0:
            return Response(tag_values_formatted, status=200)
        else:
            raise NotFound(self._generate_not_found_message(metric_names, tag_name))

    def _generate_not_found_message(self, metric_names: list[str], tag_name: str) -> str:
        if len(metric_names) > 0:
            return f"No data found for metric: {metric_names[0]} and tag: {tag_name}"
        else:
            return f"No data found for tag: {tag_name}"
