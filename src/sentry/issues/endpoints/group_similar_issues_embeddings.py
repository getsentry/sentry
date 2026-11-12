import logging
from collections.abc import Sequence
from typing import Annotated, TypedDict

from django.contrib.auth.models import AnonymousUser
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.analytics import GroupSimilarIssuesEmbeddingsCountEvent
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import DEFAULT_DURATION_BUDGET, cell_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import BaseGroupSerializerResponse
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.examples.issue_examples import IssueExamples
from sentry.apidocs.parameters import GlobalParams, IssueParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.principal import acting_user_id
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.grouping.grouping_info import get_grouping_info_from_variants_legacy
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.seer.similarity.config import get_grouping_model_version, should_skip_seer_fallback
from sentry.seer.similarity.similar_issues import get_similarity_data_from_seer
from sentry.seer.similarity.types import SeerSimilarIssueData, SimilarIssuesEmbeddingsRequest
from sentry.seer.similarity.utils import (
    ReferrerOptions,
    event_content_has_stacktrace,
    get_stacktrace_string,
    killswitch_enabled,
    stacktrace_exceeds_limits,
)
from sentry.service_accounts.principal import ServiceAccountPrincipal
from sentry.users.models.user import User
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)

SIMILARITY_UNAVAILABLE_DETAIL = "Similar issues are temporarily unavailable. Try again later."


class SimilarIssueScores(TypedDict):
    exception: Annotated[
        float,
        ApiDescription(
            "How similar the two issues' stack traces are, from 0 to 1. Higher is more similar. "
            "Only results scoring 0.8 or more are returned."
        ),
    ]
    wouldAutoGroup: Annotated[
        bool,
        ApiDescription(
            "Whether the stack traces are close enough that Seer would have grouped both into one "
            "issue at ingest. True results are likely duplicates of the requested issue."
        ),
    ]


SimilarIssue = tuple[BaseGroupSerializerResponse, SimilarIssueScores]


class SimilarIssuesEmbeddingsQuerySerializer(serializers.Serializer[dict[str, int]]):
    k = serializers.IntegerField(
        required=False,
        default=10,
        min_value=1,
        max_value=100,
        help_text="The maximum number of similar issues to return.",
    )


@extend_schema(tags=["Events"])
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
    ) -> list[SimilarIssue]:
        """
        Pair each similar group with its scores, turning cosine distances into similarities.
        """
        group_data: dict[int, SimilarIssueScores] = {}
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
                group_data[similar_issue_data.parent_group_id] = {
                    "exception": round(1 - similar_issue_data.stacktrace_distance, 4),
                    "wouldAutoGroup": similar_issue_data.should_group,
                }

        serialized_groups: dict[int, BaseGroupSerializerResponse] = {
            int(g["id"]): g
            for g in serialize(
                list(Group.objects.get_many_from_cache(group_data.keys())), user=user
            )
        }

        return [(serialized_groups[group_id], group_data[group_id]) for group_id in group_data]

    @extend_schema(
        operation_id="listOrganizationIssueSimilarIssues",
        summary="Find issues with similar stack traces",
        description=(
            "Returns issues in the same project whose stack traces Seer finds similar to this "
            "issue's latest event, most similar first. Each result is a pair: the issue, then its "
            "scores. Returns an empty list when the issue has no stack trace to compare or "
            "nothing similar was found. Returns 503 when Seer can't be reached."
        ),
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.ISSUES_OR_GROUPS,
            IssueParams.ISSUE_ID,
            SimilarIssuesEmbeddingsQuerySerializer,
        ],
        responses={
            200: inline_sentry_response_serializer("SimilarIssuesResponse", list[SimilarIssue]),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            503: OpenApiResponse(description="Seer similarity is unavailable"),
        },
        examples=IssueExamples.SIMILAR_ISSUES,
    )
    @deprecated(
        CELL_API_DEPRECATION_DATE, url_names=["sentry-api-0-group-similar-issues-embeddings"]
    )
    def get(
        self, request: Request, group: Group
    ) -> Response[list[SimilarIssue]] | Response[DetailResponse]:
        query = SimilarIssuesEmbeddingsQuerySerializer(data=request.GET)
        if not query.is_valid():
            raise ParseError({"detail": query.errors})

        if killswitch_enabled(group.project.id, ReferrerOptions.SIMILAR_ISSUES_TAB):
            return Response({"detail": SIMILARITY_UNAVAILABLE_DETAIL}, status=503)

        latest_event = group.get_latest_event()
        stacktrace_string = ""

        model_version = get_grouping_model_version(group.project)

        if latest_event and event_content_has_stacktrace(latest_event):
            variants = latest_event.get_grouping_variants(normalize_stacktraces=True)

            if not stacktrace_exceeds_limits(
                latest_event, variants, ReferrerOptions.SIMILAR_ISSUES_TAB, model_version
            ):
                grouping_info = get_grouping_info_from_variants_legacy(variants)
                try:
                    stacktrace_string = get_stacktrace_string(grouping_info)
                except Exception:
                    logger.exception("Unexpected exception in stacktrace string formatting")

        if not stacktrace_string or not latest_event:
            return Response([])  # No exception, stacktrace or in-app frames, or event

        similar_issues_params: SimilarIssuesEmbeddingsRequest = {
            "event_id": latest_event.event_id,
            "hash": latest_event.get_primary_hash(),
            "project_id": group.project.id,
            "stacktrace": stacktrace_string,
            "exception_type": get_path(latest_event.data, "exception", "values", -1, "type"),
            "read_only": True,
            "referrer": "similar_issues",
            "model": model_version,
            "training_mode": False,
            "platform": latest_event.platform or "unknown",
            "skip_fallback": should_skip_seer_fallback(group.project),
            "k": query.validated_data["k"],
        }

        logger.info("Similar issues embeddings parameters", extra=similar_issues_params)

        viewer_context = SeerViewerContext(
            organization_id=group.project.organization.id, user_id=acting_user_id(request.user)
        )
        try:
            results, _model_used = get_similarity_data_from_seer(
                similar_issues_params, raise_on_error=True, viewer_context=viewer_context
            )
        except Exception:
            # get_similarity_data_from_seer already logs and records a metric for each failure
            return Response({"detail": SIMILARITY_UNAVAILABLE_DETAIL}, status=503)

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
