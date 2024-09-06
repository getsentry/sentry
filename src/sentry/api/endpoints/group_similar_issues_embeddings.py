import logging
from collections.abc import Mapping, Sequence
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.grouping.grouping_info import get_grouping_info
from sentry.models.group import Group
from sentry.seer.similarity.similar_issues import get_similarity_data_from_seer
from sentry.seer.similarity.types import SeerSimilarIssueData, SimilarIssuesEmbeddingsRequest
from sentry.seer.similarity.utils import get_stacktrace_string, killswitch_enabled
from sentry.users.models.user import User
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)
MAX_FRAME_COUNT = 50


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
        self,
        similar_issues_data: Sequence[SeerSimilarIssueData],
        user: User | AnonymousUser,
    ) -> Sequence[tuple[Mapping[str, Any], Mapping[str, Any]] | None]:
        """
        Format the responses using to be used by the frontend by changing the  field names and
        changing the cosine distances into cosine similarities.
        """
        group_data = {}
        for similar_issue_data in similar_issues_data:
            formatted_response: FormattedSimilarIssuesEmbeddingsData = {
                "message": 1 - similar_issue_data.message_distance,
                "exception": 1 - similar_issue_data.stacktrace_distance,
                "shouldBeGrouped": "Yes" if similar_issue_data.should_group else "No",
            }
            group_data[similar_issue_data.parent_group_id] = formatted_response

        serialized_groups = {
            int(g["id"]): g
            for g in serialize(
                list(Group.objects.get_many_from_cache(group_data.keys())), user=user
            )
        }

        return [(serialized_groups[group_id], group_data[group_id]) for group_id in group_data]

    def get(self, request: Request, group) -> Response:
        if killswitch_enabled(group.project.id):
            return Response([])

        latest_event = group.get_latest_event()
        stacktrace_string = ""
        if latest_event and latest_event.data.get("exception"):
            grouping_info = get_grouping_info(None, project=group.project, event=latest_event)
            stacktrace_string = get_stacktrace_string(grouping_info)

        if stacktrace_string == "" or not latest_event:
            return Response([])  # No exception, stacktrace or in-app frames, or event

        similar_issues_params: SimilarIssuesEmbeddingsRequest = {
            "event_id": latest_event.event_id,
            "hash": latest_event.get_primary_hash(),
            "project_id": group.project.id,
            "stacktrace": stacktrace_string,
            "message": latest_event.title,
            "exception_type": get_path(latest_event.data, "exception", "values", -1, "type"),
            "read_only": True,
            "referrer": "similar_issues",
            "use_reranking": options.get("seer.similarity.similar_issues.use_reranking"),
        }
        # Add optional parameters
        if request.GET.get("k"):
            similar_issues_params["k"] = int(request.GET["k"])
        if request.GET.get("threshold"):
            similar_issues_params["threshold"] = float(request.GET["threshold"])

        # Override `use_reranking` value if necessary
        if request.GET.get("useReranking"):
            similar_issues_params["use_reranking"] = request.GET["useReranking"] == "true"

        extra: dict[str, Any] = dict(similar_issues_params.copy())
        extra["group_message"] = extra.pop("message")
        logger.info("Similar issues embeddings parameters", extra=extra)

        results = get_similarity_data_from_seer(similar_issues_params)

        analytics.record(
            "group_similar_issues_embeddings.count",
            organization_id=group.organization.id,
            project_id=group.project.id,
            group_id=group.id,
            hash=latest_event.get_primary_hash(),
            count_over_threshold=len(
                [
                    result.stacktrace_distance
                    for result in results
                    if result.stacktrace_distance <= 0.01
                ]
            ),
            user_id=request.user.id,
        )

        if not results:
            return Response([])
        formatted_results = self.get_formatted_results(results, request.user)

        return Response(formatted_results)
