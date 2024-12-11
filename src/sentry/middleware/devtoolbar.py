import logging

from django.http import HttpRequest, HttpResponse

from sentry import analytics, options
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils.http import origin_from_request
from sentry.utils.http import query_string as get_query_string

logger = logging.getLogger(__name__)


class DevToolbarAnalyticsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            # Note ordering of conditions to reduce option queries. GET contains the query params, regardless of method.
            if request.GET.get("queryReferrer") == "devtoolbar" and options.get(
                "devtoolbar.analytics.enabled"
            ):
                record_api_request(request, response)
        except Exception:
            logger.exception("devtoolbar: exception while recording api analytics event.")

        return response


def record_api_request(request: HttpRequest, response: HttpResponse) -> None:
    if request.resolver_match is None:
        raise ValueError(f"Request URL not resolved: {request.path_info}")

    org_slug, org_id = get_org_identifiers_from_request(request)
    proj_slug, proj_id = get_project_identifiers_from_request(request)
    origin = origin_from_request(request)
    query_string: str = get_query_string(request)  # starts with ? if non-empty

    analytics.record(
        "devtoolbar.api_request",
        view_name=request.resolver_match.view_name,
        route=request.resolver_match.route,
        query_string=query_string,
        origin=origin,
        method=request.method,
        status_code=response.status_code,
        organization_id=org_id,
        organization_slug=org_slug,
        project_id=proj_id,
        project_slug=proj_slug,
        user_id=request.user.id if hasattr(request, "user") and request.user else None,
    )


def get_org_identifiers_from_request(request: HttpRequest) -> tuple[str | None, int | None]:
    """
    Get the slug or id of the Sentry organization targeted by an API request. Since it's run in middleware, this
    function should NOT talk to external services (e.g. Postgres) or do any expensive operations.

    Args:
        request - a resolved HTTP request. request.resolver_match must be non-None.
    Returns:
        The organization's slug and id. Possible results:
        (slug, None) - prioritized if any org info can be parsed.
        (None, id)   - returned if a slug could not be parsed.
        (None, None) - no org info could be parsed.
    """
    if request.resolver_match is None:
        raise ValueError(f"Request URL not resolved: {request.path_info}")
    kwargs = request.resolver_match.kwargs

    # If the request has been processed, some endpoints will have done a Postgres query for us.
    org_obj = kwargs.get("organization")
    if isinstance(org_obj, Organization):
        return org_obj.slug, None

    # Try all conceivable URL params, regardless of current URL patterns.
    org_id_or_slug = (
        kwargs.get("organization_slug")
        or kwargs.get("organization_id_or_slug")
        or kwargs.get("organization_id")
    )

    if isinstance(org_id_or_slug, int):
        return None, org_id_or_slug

    if isinstance(org_id_or_slug, str):
        if org_id_or_slug.isnumeric():
            return None, int(org_id_or_slug)
        return org_id_or_slug, None

    return None, None


def get_project_identifiers_from_request(request: HttpRequest) -> tuple[str | None, int | None]:
    """
    Get the slug or id of the Sentry project targeted by an API request. Since it's run in middleware, this
    function should NOT make queries to external services (e.g. Postgres), or any other expensive operations.

    Args:
        request - a resolved HTTP request. request.resolver_match must be non-None.
    Returns:
        The project's slug and id. Possible results:
        (slug, None) - prioritized if any project info can be parsed.
        (None, id)   - returned if a slug could not be parsed.
        (None, None) - no project info could be parsed.
    """
    if request.resolver_match is None:
        raise ValueError(f"Request URL not resolved: {request.path_info}")
    kwargs = request.resolver_match.kwargs

    # If the request has been processed, some endpoints will have done a Postgres query for us.
    proj_obj = kwargs.get("project")
    if isinstance(proj_obj, Project):
        return proj_obj.slug, None

    # Try all conceivable URL params, regardless of current URL patterns.
    proj_id_or_slug = (
        kwargs.get("project_slug") or kwargs.get("project_id_or_slug") or kwargs.get("project_id")
    )

    if isinstance(proj_id_or_slug, int):
        return None, proj_id_or_slug

    if isinstance(proj_id_or_slug, str):
        if proj_id_or_slug.isnumeric():
            return None, int(proj_id_or_slug)
        return proj_id_or_slug, None

    return None, None
