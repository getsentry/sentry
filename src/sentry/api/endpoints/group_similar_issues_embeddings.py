import logging
from collections.abc import Mapping, Sequence
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.eventstore.models import GroupEvent
from sentry.models.group import Group
from sentry.models.user import User
from sentry.seer.utils import (
    SimilarIssuesEmbeddingsData,
    SimilarIssuesEmbeddingsRequest,
    get_similar_issues_embeddings,
)
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
                if frame["in_app"]:
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


class FormattedSimilarIssuesEmbeddingsData(TypedDict):
    exception: float
    message: float
    shouldBeGrouped: str


@region_silo_endpoint
class GroupSimilarIssuesEmbeddingsEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get_formatted_results(
        self, responses: Sequence[SimilarIssuesEmbeddingsData | None], user: User | AnonymousUser
    ) -> Sequence[tuple[Mapping[str, Any], Mapping[str, Any]] | None]:
        """Format the responses using to be used by the frontend."""
        group_data = {}
        for response in responses:
            if response:
                formatted_response: FormattedSimilarIssuesEmbeddingsData = {
                    "message": response["message_similarity"],
                    "exception": response["stacktrace_similarity"],
                    "shouldBeGrouped": "Yes" if response["should_group"] else "No",
                }
                group_data.update({response["parent_group_id"]: formatted_response})

        serialized_groups = {
            int(g["id"]): g
            for g in serialize(
                list(Group.objects.get_many_from_cache(group_data.keys())), user=user
            )
        }

        result = []
        for group_id in group_data:
            try:
                result.append((serialized_groups[group_id], group_data[group_id]))
            except KeyError:
                # KeyErrors may occur if seer API returns a deleted/merged group
                continue
        return result

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

        analytics.record(
            "group_similar_issues_embeddings.count",
            organization_id=group.organization.id,
            project_id=group.project.id,
            group_id=group.id,
            count_over_threshold=len(
                [
                    result["stacktrace_similarity"]  # type: ignore
                    for result in results["responses"]
                    if result["stacktrace_similarity"] > 0.99  # type: ignore
                ]
            )
            if results["responses"]
            else 0,
            user_id=request.user.id,
        )

        if not results["responses"]:
            return Response([])
        formatted_results = self.get_formatted_results(results["responses"], request.user)

        return Response(formatted_results)
