import logging

from django.http import HttpRequest, HttpResponse

from sentry import analytics
from sentry.utils.http import origin_from_request, parse_id_or_slug_param, query_string

logger = logging.getLogger(__name__)


class DevToolbarAnalyticsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            response = self.get_response(request)
        except Exception as e:
            response = HttpResponse(content=type(e).__name__.encode(), status=500)
            raise  # delegate to Django exception handlers
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

        kwargs, url_name, endpoint_name = (
            resolver_match.kwargs,
            resolver_match.url_name,
            resolver_match.view_name,
        )

        org_id_or_slug = kwargs.get("organization_id_or_slug", kwargs.get("organization_slug"))
        org_id, org_slug = parse_id_or_slug_param(org_id_or_slug)
        project_id_or_slug = kwargs.get("project_id_or_slug")
        project_id, project_slug = parse_id_or_slug_param(project_id_or_slug)

        origin = origin_from_request(request)
        query = query_string(request)  # starts with '?'
        analytics.record(
            "devtoolbar.request",
            endpoint_name=endpoint_name,
            url_pattern=url_name,  # TODO: test
            query=query,
            origin=origin,
            response_code=response.status_code,
            organization_id=str(org_id) if org_id else None,
            organization_slug=org_slug,
            project_id=str(project_id) if project_id else None,
            project_slug=project_slug,
            user_id=str(request.user.id) if request.user else None,
        )
    except Exception:
        logger.exception(
            "devtoolbar: failed to record api analytics event.",
            extra={"org_slug": org_slug, "project_slug": project_slug},
        )
