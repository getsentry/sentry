from collections.abc import Sequence

from rest_framework.exceptions import ParseError
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
from sentry.auth.elevated_mode import has_elevated_mode
from sentry.exceptions import InvalidParams
from sentry.sentry_metrics.querying.metadata import get_metrics_meta
from sentry.sentry_metrics.use_case_id_registry import (
    UseCaseID,
    UseCaseIDAPIAccess,
    get_use_case_id_api_access,
)
from sentry.sentry_metrics.utils import string_to_use_case_id


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
