import logging

from django.http import HttpRequest, HttpResponse

from sentry import analytics
from sentry.utils.http import origin_from_request
from sentry.utils.http import query_string as get_query_string
from sentry.utils.urls import parse_id_or_slug_param

logger = logging.getLogger(__name__)


class DevToolbarAnalyticsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            response = self.get_response(request)
        except Exception:
            response = HttpResponse(status=500)
            raise  # delegate to our API exception handlers
        finally:
            _record_api_request(request, response)

        return response


def _record_api_request(request: HttpRequest, response: HttpResponse) -> None:
    org_id, org_slug, project_id, project_slug = None, None, None, None
    try:
        if request.headers.get("queryReferrer") != "devtoolbar":
            return None

        resolver_match = request.resolver_match
        if resolver_match is None:
            raise ValueError(f"Request URL not resolved: {request.path_info}")

        kwargs, route, endpoint_name = (
            resolver_match.kwargs,
            resolver_match.route,
            resolver_match.view_name,
        )

        org_id_or_slug = kwargs.get("organization_id_or_slug", kwargs.get("organization_slug"))
        org_id, org_slug = parse_id_or_slug_param(org_id_or_slug)
        project_id_or_slug = kwargs.get("project_id_or_slug")
        project_id, project_slug = parse_id_or_slug_param(project_id_or_slug)

        origin = origin_from_request(request)
        query_string: str = get_query_string(request)  # starts with '?'
        analytics.record(
            "devtoolbar.api_request",
            endpoint_name=endpoint_name,
            route=route,
            query_string=query_string,
            origin=origin,
            request_method=request.method,
            response_code=response.status_code,
            organization_id=org_id or None,  # TODO: make sure you can pass in ints
            organization_slug=org_slug,
            project_id=project_id or None,
            project_slug=project_slug,
            user_id=request.user.id if hasattr(request, "user") and request.user else None,
        )
    except Exception:
        logger.exception(
            "devtoolbar: failed to record api analytics event.",
            extra={"org_slug": org_slug, "project_slug": project_slug},
        )
