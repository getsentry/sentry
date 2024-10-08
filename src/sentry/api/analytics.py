import logging

from rest_framework.request import Request

from sentry import analytics
from sentry.utils.http import get_api_relative_path, origin_from_request, query_string

logger = logging.getLogger(__name__)


class OrganizationSavedSearchCreatedEvent(analytics.Event):
    type = "organization_saved_search.created"

    attributes = (
        analytics.Attribute("org_id"),
        analytics.Attribute("search_type"),
        analytics.Attribute("query"),
    )


class OrganizationSavedSearchDeletedEvent(analytics.Event):
    type = "organization_saved_search.deleted"

    attributes = (
        analytics.Attribute("org_id"),
        analytics.Attribute("search_type"),
        analytics.Attribute("query"),
    )


class GroupSimilarIssuesEmbeddingsCountEvent(analytics.Event):
    type = "group_similar_issues_embeddings.count"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("user_id"),
        analytics.Attribute("count_over_threshold", required=False),
    )


class DevToolbarRequestEvent(analytics.Event):
    type = "devtoolbar.request"

    attributes = (
        analytics.Attribute("path"),  # path to endpoint
        analytics.Attribute("query"),  # string or dict?
        analytics.Attribute("origin"),
        analytics.Attribute("organization_slug"),
        analytics.Attribute("project_slug"),
        analytics.Attribute("user_id"),  # needed to aggregate/send to amplitude(?)
    )


def track_devtoolbar_api_analytics(
    request: Request, org_slug: str | None = None, project_slug: str | None = None
):
    try:
        origin = origin_from_request(request)
        query = query_string(request)  # starts with ?
        path = get_api_relative_path(
            request, scope="project" if project_slug else "organization" if org_slug else None
        )
        analytics.record(
            "devtoolbar.request",
            path=path,
            query=query,
            origin=origin,
            organization_slug=org_slug,
            project_slug=project_slug,
            user_id=str(request.user.id) if request.user else None,
        )
    except Exception:
        logger.exception(
            "devtoolbar: failed to record api analytics event.",
            extra={"org_slug": org_slug, "project_slug": project_slug},
        )


analytics.register(OrganizationSavedSearchCreatedEvent)
analytics.register(OrganizationSavedSearchDeletedEvent)
analytics.register(GroupSimilarIssuesEmbeddingsCountEvent)
analytics.register(DevToolbarRequestEvent)
