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
from sentry.api.endpoints.event_grouping_info import get_grouping_info
from sentry.api.serializers import serialize
from sentry.models.group import Group
from sentry.models.user import User
from sentry.seer.utils import (
    SimilarIssuesEmbeddingsData,
    SimilarIssuesEmbeddingsRequest,
    get_similar_issues_embeddings,
)
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)
MAX_FRAME_COUNT = 50


def get_value_if_exists(exception_value):
    return exception_value["values"][0] if exception_value.get("values") else ""


def get_stacktrace_string(data):
    """Format a stacktrace string from the grouping information."""
    if not (
        get_path(data, "app", "hash") and get_path(data, "app", "component", "values")
    ) and not (
        get_path(data, "system", "hash") and get_path(data, "system", "component", "values")
    ):
        return ""

    # Get the data used for grouping
    if get_path(data, "app", "hash"):
        exceptions = data["app"]["component"]["values"]
    else:
        exceptions = data["system"]["component"]["values"]

    # Handle chained exceptions
    if exceptions and exceptions[0].get("id") == "chained-exception":
        exceptions = exceptions[0].get("values")

    frame_count = 0
    stacktrace_str = ""
    for exception in exceptions:
        if exception.get("id") not in ["exception", "threads"]:
            continue

        # For each exception, extract its type, value, and stacktrace frames
        exc_type, exc_value, frame_str = "", "", ""
        for exception_value in exception.get("values", []):
            contributing_frames = []
            if exception_value.get("id") == "type":
                exc_type = get_value_if_exists(exception_value)
            elif exception_value.get("id") == "value":
                exc_value = get_value_if_exists(exception_value)
            elif exception_value.get("id") == "stacktrace":
                # Take the last 50 in-app and contributing frames
                contributing_frames = [
                    frame
                    for frame in exception_value["values"]
                    if frame.get("id") == "frame" and frame.get("contributes")
                ]
                num_frames = len(contributing_frames)
                if frame_count + num_frames > MAX_FRAME_COUNT:
                    remaining_frame_count = MAX_FRAME_COUNT - frame_count
                    contributing_frames = contributing_frames[-remaining_frame_count:]
                    frame_count += remaining_frame_count
                    num_frames = remaining_frame_count
                frame_count += num_frames

                for frame in contributing_frames:
                    frame_dict = {"filename": "", "function": "", "context-line": ""}
                    for frame_values in frame.get("values", []):
                        if frame_values.get("id") in frame_dict:
                            frame_dict[frame_values["id"]] = get_value_if_exists(frame_values)

                    frame_str += f'  File "{frame_dict["filename"]}", line {frame_dict["function"]}\n    {frame_dict["context-line"]}\n'

        # Add the exception values into the formatted string
        if exception.get("contributes"):
            if exception.get("id") == "exception":
                stacktrace_str += f"{exc_type}: {exc_value}\n"
            if frame_str:
                stacktrace_str += frame_str

    return stacktrace_str.strip()


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
            grouping_info = get_grouping_info(
                None, project=group.project, event_id=latest_event.event_id
            )
            stacktrace_string = get_stacktrace_string(grouping_info)

        if stacktrace_string == "":
            return Response([])  # No exception, stacktrace or in-app frames

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
                    result["stacktrace_distance"]  # type: ignore
                    for result in results["responses"]
                    if result["stacktrace_distance"] <= 0.01  # type: ignore
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
