import logging
from collections.abc import Mapping
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.eventstore.models import GroupEvent
from sentry.seer.utils import SimilarIssuesEmbeddingsRequest, get_similar_issues_embeddings
from sentry.web.helpers import render_to_string

logger = logging.getLogger(__name__)


def get_stacktrace_string(exception: Mapping[Any, Any], event: GroupEvent) -> str:
    """Get the stacktrace string from an exception dictionary."""
    if not exception["values"]:
        return ""

    output = []
    for exc in exception["values"]:
        if not exc:
            continue

        output.append(f'{exc["type"]}: {exc["value"]}')
        if exc["stacktrace"] and exc["stacktrace"].get("frames"):
            choices = [event.platform, "default"] if event.platform else ["default"]
            templates = [f"sentry/partial/frames/{choice}.txt" for choice in choices]
            for frame in exc["stacktrace"]["frames"]:
                output.append(
                    render_to_string(
                        templates,
                        {
                            "abs_path": frame.get("abs_path"),
                            "filename": frame.get("filename"),
                            "function": frame.get("function"),
                            "module": frame.get("module"),
                            "lineno": frame.get("lineno"),
                            "colno": frame.get("colno"),
                            "context_line": frame.get("context_line"),
                        },
                    ).strip("\n")
                )

    return "\n".join(output)


@region_silo_endpoint
class GroupSimilarIssuesEmbeddingsEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, group) -> Response:
        if not features.has("projects:similarity-embeddings", group.project):
            return Response(status=404)

        latest_event = group.get_latest_event()
        stacktrace_string = get_stacktrace_string(latest_event.data["exception"], latest_event)

        similar_issues_params: SimilarIssuesEmbeddingsRequest = {
            "group_id": group.id,
            "stacktrace": stacktrace_string,
            "message": group.message,
        }
        # Add optional parameters
        if request.GET.get("k"):
            similar_issues_params.update({"k": int(request.GET["k"])})
        if request.GET.get("threshold"):
            similar_issues_params.update({"threshold": float(request.GET["threshold"])})

        results = get_similar_issues_embeddings(similar_issues_params)
        return Response(results)
