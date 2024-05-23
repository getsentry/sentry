from collections.abc import Sequence

from rest_framework.exceptions import NotFound, ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationAndStaffPermission,
    OrganizationEndpoint,
    OrganizationPermission,
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.utils import get_date_range_from_params
from sentry.auth.elevated_mode import has_elevated_mode
from sentry.exceptions import InvalidParams
from sentry.sentry_metrics.querying.metadata import (
    convert_metric_names_to_mris,
    get_metrics_meta,
    get_tag_values,
)
from sentry.sentry_metrics.use_case_id_registry import (
    UseCaseID,
    UseCaseIDAPIAccess,
    get_use_case_id_api_access,
)
from sentry.sentry_metrics.utils import string_to_use_case_id
from sentry.snuba.metrics import get_all_tags, get_single_metric_info
from sentry.snuba.metrics.utils import DerivedMetricParseException
from sentry.snuba.sessions_v2 import InvalidField


def can_access_use_case_id(request: Request, use_case_id: UseCaseID) -> bool:
    api_access = get_use_case_id_api_access(use_case_id)
    return api_access == UseCaseIDAPIAccess.PUBLIC or (
        has_elevated_mode(request) and api_access == UseCaseIDAPIAccess.PRIVATE
    )


def get_default_use_case_ids(request: Request) -> Sequence[UseCaseID]:
    """
    Gets the default use case ids given a Request.

    Args:
        request: Request of the endpoint.

    Returns:
        A list of use case ids that can be used for the API request.
    """
    default_use_case_ids = []

    for use_case_id in UseCaseID:
        if not can_access_use_case_id(request, use_case_id):
            continue

        default_use_case_ids.append(use_case_id)

    return default_use_case_ids


def get_use_case_id(request: Request) -> UseCaseID:
    """
    Gets the use case id from the Request. If the use case id is malformed or private the entire request will fail.

    Args:
        request: Request of the endpoint.

    Returns:
        The use case id that was request or a default use case id.
    """
    try:
        use_case_id = string_to_use_case_id(request.GET.get("useCase", UseCaseID.SESSIONS.value))
        if not can_access_use_case_id(request, use_case_id):
            raise ParseError(detail="The supplied use case doesn't exist or it's private")

        return use_case_id
    except ValueError:
        raise ParseError(detail="The supplied use case doesn't exist or it's private")


def get_use_case_ids(request: Request) -> Sequence[UseCaseID]:
    """
    Gets the use case ids from the Request. If at least one use case id is malformed or private the entire request
    will fail.

    Args:
        request: Request of the endpoint.

    Returns:
        The use case ids that were requested or the default use case ids.
    """
    try:
        use_case_ids = [
            string_to_use_case_id(use_case_param)
            for use_case_param in request.GET.getlist("useCase", get_default_use_case_ids(request))
        ]
        for use_case_id in use_case_ids:
            if not can_access_use_case_id(request, use_case_id):
                raise ParseError(detail="The supplied use case doesn't exist or it's private")

        return use_case_ids
    except ValueError:
        raise ParseError(detail="One or more supplied use cases doesn't exist or it's private")


class OrganizationMetricsEnrollPermission(OrganizationPermission):
    scope_map = {"PUT": ["org:read", "org:write", "org:admin"]}


@region_silo_endpoint
class OrganizationMetricsDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (OrganizationAndStaffPermission,)

    """Get the metadata of all the stored metrics including metric name, available operations and metric unit"""

    def get(self, request: Request, organization) -> Response:
        projects = self.get_projects(request, organization)
        if not projects:
            raise InvalidParams("You must supply at least one project to see its metrics")

        metrics = get_metrics_meta(
            organization=organization, projects=projects, use_case_ids=get_use_case_ids(request)
        )

        return Response(metrics, status=200)


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


@region_silo_endpoint
class OrganizationMetricsTagsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (OrganizationAndStaffPermission,)

    """Get list of tag names for this project

    If the ``metric`` query param is provided, only tags for a certain metric
    are provided.

    If the ``metric`` query param is provided more than once, the *intersection*
    of available tags is used.
    """

    def get(self, request: Request, organization) -> Response:
        metric_names = request.GET.getlist("metric") or []
        projects = self.get_projects(request, organization)
        if not projects:
            raise InvalidParams("You must supply at least one project to see the tag names")

        start, end = get_date_range_from_params(request.GET)

        try:
            tags = get_all_tags(
                projects=projects,
                metric_names=metric_names,
                use_case_id=get_use_case_id(request),
                start=start,
                end=end,
            )
        except (InvalidParams, DerivedMetricParseException) as exc:
            raise (ParseError(detail=str(exc)))

        return Response(tags, status=200)


@region_silo_endpoint
class OrganizationMetricsTagDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    """Get all existing tag values for a metric"""

    def get(self, request: Request, organization, tag_name) -> Response:
        metric_names = request.GET.getlist("metric") or []
        if len(metric_names) > 1:
            raise ParseError(
                "Please supply only a single metric name. Specifying multiple metric names is not supported for this endpoint."
            )
        projects = self.get_projects(request, organization)
        if not projects:
            raise InvalidParams("You must supply at least one project to see the tag values")

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
                )
                tag_values = tag_values.union(mri_tag_values)

        except InvalidParams:
            raise NotFound(self._generate_not_found_message(metric_names, tag_name))

        except DerivedMetricParseException as exc:
            raise ParseError(str(exc))

        tag_values_formatted = [{"key": tag_name, "value": tag_value} for tag_value in tag_values]

        if len(tag_values_formatted) > 0:
            return Response(tag_values_formatted, status=200)
        else:
            raise NotFound(self._generate_not_found_message(metric_names, tag_name))

    def _generate_not_found_message(self, metric_names: list[str], tag_name: str) -> str:
        if len(metric_names) > 0:
            return f"No data found for metric: {metric_names[0]} and tag: {tag_name}"
        else:
            return f"No data found for tag: {tag_name}"
