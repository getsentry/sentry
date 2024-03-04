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

logger = logging.getLogger(__name__)
MAX_FRAME_COUNT = 50


def get_stacktrace_string(exception: Mapping[Any, Any], event: GroupEvent) -> str:
    """Get the stacktrace string from an exception dictionary."""
    if not exception.get("values"):
        return ""

    frame_count = 0
    output = ""
    for exc in exception["values"]:
        if not exc or not exc.get("stacktrace"):
            continue

        if exc["stacktrace"] and exc["stacktrace"].get("frames"):
            # If the total number of frames exceeds 50, keep only the last in-app 50 frames
            in_app_frames = [frame for frame in exc["stacktrace"]["frames"] if frame["in_app"]]
            num_frames = len(in_app_frames)
            if frame_count + num_frames > MAX_FRAME_COUNT:
                remaining_frame_count = MAX_FRAME_COUNT - frame_count
                in_app_frames = in_app_frames[-remaining_frame_count:]
                frame_count += remaining_frame_count
                num_frames = remaining_frame_count
            frame_count += num_frames

            if in_app_frames:
                output += exc.get("type") + ": " + exc.get("value") + "\n"

            for frame in in_app_frames:
                output += '  File "{}", line {}, in {}\n    {}\n'.format(
                    frame.get("filename", ""),
                    frame.get("lineno", ""),
                    frame.get("function", ""),
                    frame.get("context_line", "").strip(),
                )

    return output.strip()


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
        """
        Format the responses using to be used by the frontend by changing the  field names and
        changing the cosine distances into cosine similarities.
        """
        group_data = {}
        for response in responses:
            if response:
                formatted_response: FormattedSimilarIssuesEmbeddingsData = {
                    "message": 1 - response["message_distance"],
                    "exception": 1 - response["stacktrace_distance"],
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
        stacktrace_string = ""
        if latest_event.data.get("exception"):
            stacktrace_string = get_stacktrace_string(latest_event.data["exception"], latest_event)

        if stacktrace_string == "":
            return Response([])  # No stacktrace or in-app frames

        similar_issues_params: SimilarIssuesEmbeddingsRequest = {
            "group_id": group.id,
            "project_id": group.project.id,
            "stacktrace": stacktrace_string,
            "message": group.message,
        }
        # Add optional parameters
        if request.GET.get("k"):
            similar_issues_params.update({"k": int(request.GET["k"])})
        if request.GET.get("threshold"):
            similar_issues_params.update({"threshold": float(request.GET["threshold"])})

        extra: dict[str, Any] = dict(similar_issues_params.copy())
        extra["group_message"] = extra.pop("message")
        logger.info("Similar issues embeddings parameters", extra=extra)

        results = get_similar_issues_embeddings(similar_issues_params)

        analytics.record(
            "group_similar_issues_embeddings.count",
            organization_id=group.organization.id,
            project_id=group.project.id,
            group_id=group.id,
            count_over_threshold=len(
                [
                    result["stacktrace_distance"]
                    for result in results["responses"]
                    if result and result["stacktrace_distance"] <= 0.01
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
