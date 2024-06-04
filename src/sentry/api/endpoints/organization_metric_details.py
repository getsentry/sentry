from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.endpoints.organization_metrics import get_use_case_id
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.exceptions import InvalidParams
from sentry.snuba.metrics import DerivedMetricParseException, get_single_metric_info
from sentry.snuba.sessions_v2 import InvalidField


@region_silo_endpoint
class OrganizationMetricDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    """Get metric name, available operations, metric unit and available tags"""

    def get(self, request: Request, organization, metric_name) -> Response:
        # Right now this endpoint is not used, however we are planning an entire refactor of
        # the metrics endpoints.
        projects = self.get_projects(request, organization)
        if not projects:
            raise InvalidParams(
                "You must supply at least one project to see the details of a metric"
            )

        try:
            metric = get_single_metric_info(
                projects=projects,
                metric_name=metric_name,
                use_case_id=get_use_case_id(request),
            )
        except InvalidParams as exc:
            raise ResourceDoesNotExist(detail=str(exc))
        except (InvalidField, DerivedMetricParseException) as exc:
            raise ParseError(detail=str(exc))

        return Response(metric, status=200)
