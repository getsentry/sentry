import logging

from sentry import analytics
from sentry.utils.http import (
    get_api_path_from_request,
    origin_from_request,
    parse_id_or_slug_param,
    query_string,
)

logger = logging.getLogger(__name__)


class AnalyticsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_view(self, request, _view_func, _view_args, view_kwargs) -> None:
        # Intercepts requests right before they're passed to the Endpoint/View.
        org_id, org_slug, project_id, project_slug = None, None, None, None
        try:
            if request.headers.get("queryReferrer") == "devtoolbar":
                org_id_or_slug = view_kwargs.get(
                    "organization_id_or_slug", view_kwargs.get("organization_slug")
                )
                org_id, org_slug = parse_id_or_slug_param(org_id_or_slug)

                project_id_or_slug = view_kwargs.get("project_id_or_slug")
                project_id, project_slug = parse_id_or_slug_param(project_id_or_slug)

                issue_id = view_kwargs.get("issue_id")
                scope = (
                    "group"
                    if issue_id
                    else "project"
                    if project_id_or_slug
                    else "organization"
                    if org_id_or_slug
                    else None
                )

                origin = origin_from_request(request)
                query = query_string(request)  # starts with '?'
                path = get_api_path_from_request(request, scope)
                analytics.record(
                    "devtoolbar.request",
                    path=path,
                    query=query,
                    origin=origin,
                    organization_id=str(org_id) if org_id else None,
                    organization_slug=org_slug,
                    project_id=str(project_id) if project_id else None,
                    project_slug=project_slug,
                    issue_id=issue_id,
                    user_id=str(request.user.id) if request.user else None,
                )
        except Exception:
            logger.exception(
                "devtoolbar: failed to record api analytics event.",
                extra={"org_slug": org_slug, "project_slug": project_slug},
            )
