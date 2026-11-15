import logging
from collections.abc import Mapping, Sequence
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.analytics import GroupSimilarIssuesEmbeddingsCountEvent
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import DEFAULT_DURATION_BUDGET, cell_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.api.serializers import serialize
from sentry.auth.principal import acting_user_id
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.issues.related.similar_stacktrace import build_seer_request, get_seer_stacktrace
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.seer.similarity.config import get_grouping_model_version
from sentry.seer.similarity.similar_issues import get_similarity_data_from_seer
from sentry.seer.similarity.types import SeerSimilarIssueData
from sentry.seer.similarity.utils import ReferrerOptions, killswitch_enabled
from sentry.service_accounts.principal import ServiceAccountPrincipal
from sentry.users.models.user import User

logger = logging.getLogger(__name__)


class FormattedSimilarIssuesEmbeddingsData(TypedDict):
    exception: float
    shouldBeGrouped: str


@cell_silo_endpoint
class GroupSimilarIssuesEmbeddingsEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    max_acceptable_duration = DEFAULT_DURATION_BUDGET
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get_formatted_results(
        self,
        similar_issues_data: Sequence[SeerSimilarIssueData],
        user: User | AnonymousUser | ServiceAccountPrincipal,
        group: Group,
    ) -> Sequence[tuple[Mapping[str, Any], Mapping[str, Any]] | None]:
        """
        Format the responses using to be used by the frontend by changing the  field names and
        changing the cosine distances into cosine similarities.
        """
        group_data = {}
        parent_hashes = [
            similar_issue_data.parent_hash for similar_issue_data in similar_issues_data
        ]
        group_hashes = GroupHash.objects.filter(project_id=group.project_id, hash__in=parent_hashes)
        parent_hashes_group_ids = {
            group_hash.hash: group_hash.group_id for group_hash in group_hashes
        }
        for similar_issue_data in similar_issues_data:
            if parent_hashes_group_ids[similar_issue_data.parent_hash] != group.id:
                # Results are sorted by ascending distance, so the first occurrence of each
                # group has the best (lowest distance / highest similarity) score. Skip
                # duplicates to avoid overwriting a better score with a worse one while
                # keeping the dict insertion position from the first (best) entry.
                if similar_issue_data.parent_group_id in group_data:
                    continue
                formatted_response: FormattedSimilarIssuesEmbeddingsData = {
                    "exception": round(1 - similar_issue_data.stacktrace_distance, 4),
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

    @deprecated(
        CELL_API_DEPRECATION_DATE, url_names=["sentry-api-0-group-similar-issues-embeddings"]
    )
    def get(self, request: Request, group: Group) -> Response:
        if killswitch_enabled(group.project.id, ReferrerOptions.SIMILAR_ISSUES_TAB):
            return Response([])

        latest_event = group.get_latest_event()
        if latest_event is None:
            return Response([])

        model_version = get_grouping_model_version(group.project)
        stacktrace_string = get_seer_stacktrace(latest_event, model_version)
        if not stacktrace_string:
            return Response([])  # No exception, stacktrace or in-app frames

        similar_issues_params = build_seer_request(
            latest_event, group.project, stacktrace_string, model_version
        )
        # Add optional parameters
        if request.GET.get("k"):
            similar_issues_params["k"] = int(request.GET["k"])
        if request.GET.get("threshold"):
            similar_issues_params["threshold"] = float(request.GET["threshold"])

        logger.info("Similar issues embeddings parameters", extra=similar_issues_params)

        viewer_context = SeerViewerContext(
            organization_id=group.project.organization.id, user_id=acting_user_id(request.user)
        )
        results, _model_used = get_similarity_data_from_seer(
            similar_issues_params, viewer_context=viewer_context
        )

        analytics.record(
            GroupSimilarIssuesEmbeddingsCountEvent(
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
                user_id=acting_user_id(request.user),
            )
        )

        if not results:
            return Response([])
        formatted_results = self.get_formatted_results(results, request.user, group)

        return Response(formatted_results)
