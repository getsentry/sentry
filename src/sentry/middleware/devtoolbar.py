import logging

from django.http import HttpRequest, HttpResponse

from sentry import analytics, options
from sentry.utils.http import origin_from_request
from sentry.utils.http import query_string as get_query_string
from sentry.utils.urls import parse_id_or_slug_param

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
                _record_api_request(request, response)
        except Exception:
            logger.exception("devtoolbar: exception while recording api analytics event.")

        return response


def _record_api_request(request: HttpRequest, response: HttpResponse) -> None:
    resolver_match = request.resolver_match
    if resolver_match is None:
        raise ValueError(f"Request URL not resolved: {request.path_info}")

    kwargs, route, view_name = (
        resolver_match.kwargs,
        resolver_match.route,
        resolver_match.view_name,
    )

    org_id_or_slug = kwargs.get("organization_id_or_slug", kwargs.get("organization_slug"))
    org_id, org_slug = parse_id_or_slug_param(org_id_or_slug)
    project_id_or_slug = kwargs.get("project_id_or_slug")
    project_id, project_slug = parse_id_or_slug_param(project_id_or_slug)

    origin = origin_from_request(request)
    query_string: str = get_query_string(request)  # starts with ? if non-empty

    analytics.record(
        "devtoolbar.api_request",
        view_name=view_name,
        route=route,
        query_string=query_string,
        origin=origin,
        method=request.method,
        status_code=response.status_code,
        organization_id=org_id or None,
        organization_slug=org_slug,
        project_id=project_id or None,
        project_slug=project_slug,
        user_id=request.user.id if hasattr(request, "user") and request.user else None,
    )
