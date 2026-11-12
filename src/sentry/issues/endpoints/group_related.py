from typing import Any

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import DEFAULT_DURATION_BUDGET, cell_silo_endpoint
from sentry.api.helpers.projects import filter_projects_by_permissions
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.issue_examples import IssueExamples
from sentry.apidocs.parameters import GlobalParams, IssueParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.spectacular_ports import build_choice_description_list
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.issues.related.combine import combine
from sentry.issues.related.contributing import CONTRIBUTING_DESCRIPTION, contributing_issues
from sentry.issues.related.same_trace import SAME_TRACE_DESCRIPTION, same_trace_issues
from sentry.issues.related.similar_stacktrace import (
    SIMILAR_STACKTRACE_DESCRIPTION,
    similar_stacktrace_issues,
)
from sentry.issues.related.types import (
    RelatedIssuesContext,
    RelatedIssuesResponse,
    RelationType,
    RelationTypeResult,
    RelationTypeStatus,
)
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory

ALL_TYPES_UNAVAILABLE_DETAIL = "Related issues are temporarily unavailable. Try again later."


# Each type and what it finds. The type parameter's description lists them.
TYPE_DESCRIPTIONS = [
    (RelationType.SIMILAR_STACKTRACE.value, SIMILAR_STACKTRACE_DESCRIPTION),
    (RelationType.SAME_TRACE.value, SAME_TRACE_DESCRIPTION),
    (RelationType.CONTRIBUTING.value, CONTRIBUTING_DESCRIPTION),
]


class GroupRelatedQuerySerializer(serializers.Serializer[dict[str, Any]]):
    type = serializers.MultipleChoiceField(
        choices=[value for value, _description in TYPE_DESCRIPTIONS],
        required=False,
        help_text=(
            "Which types of related issues to return. Repeat to ask for several. Defaults to all."
            "\n\n" + build_choice_description_list(TYPE_DESCRIPTIONS)
        ),
    )
    limit = serializers.IntegerField(
        required=False,
        default=10,
        min_value=1,
        max_value=100,
        help_text="The maximum number of issues to return for each type.",
    )


@extend_schema(tags=["Events"])
@cell_silo_endpoint
class GroupRelatedEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    max_acceptable_duration = DEFAULT_DURATION_BUDGET
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=15, window=5),
                RateLimitCategory.USER: RateLimit(limit=15, window=5),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=15, window=1),
            }
        }
    )

    @extend_schema(
        operation_id="listOrganizationIssueRelatedIssues",
        summary="Find issues related to an issue",
        description=(
            "Returns other issues related to this one, each with the types of relation that "
            "matched it. Use it when triaging an issue, before resolving or ignoring it, to find "
            "duplicates and other issues connected to it. The type parameter lists each type and "
            "what it finds. meta.types says whether each requested type ran, doesn't apply to "
            "this issue, or failed. Returns 503 only when every requested type failed."
        ),
        parameters=[GlobalParams.ORG_ID_OR_SLUG, IssueParams.ISSUE_ID, GroupRelatedQuerySerializer],
        responses={
            200: inline_sentry_response_serializer("RelatedIssuesResponse", RelatedIssuesResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
            503: OpenApiResponse(description="Every requested type failed"),
        },
        examples=IssueExamples.RELATED_ISSUES,
    )
    def get(
        self, request: Request, group: Group
    ) -> Response[RelatedIssuesResponse] | Response[DetailResponse]:
        query = GroupRelatedQuerySerializer(data=request.GET)
        if not query.is_valid():
            raise ParseError({"detail": query.errors})
        params = query.validated_data

        ctx = RelatedIssuesContext(
            group=group,
            event=group.get_latest_event(),
            limit=params["limit"],
            user=request.user,
        )
        requested_types = params.get("type")  # empty means all
        results: dict[RelationType, RelationTypeResult] = {}
        if not requested_types or RelationType.SIMILAR_STACKTRACE in requested_types:
            results[RelationType.SIMILAR_STACKTRACE] = similar_stacktrace_issues(ctx)
        if not requested_types or RelationType.SAME_TRACE in requested_types:
            results[RelationType.SAME_TRACE] = same_trace_issues(
                ctx, _readable_projects(request, group.project.organization_id)
            )
        if not requested_types or RelationType.CONTRIBUTING in requested_types:
            results[RelationType.CONTRIBUTING] = contributing_issues(ctx)

        if all(
            result.meta["status"] == RelationTypeStatus.UNAVAILABLE for result in results.values()
        ):
            return Response({"detail": ALL_TYPES_UNAVAILABLE_DETAIL}, status=503)
        return Response(combine(ctx, results))


def _readable_projects(request: Request, organization_id: int) -> list[Project]:
    """The organization's active projects that the caller can read, as RelatedIssuesEndpoint does."""
    projects = Project.objects.filter(organization_id=organization_id, status=ObjectStatus.ACTIVE)
    return filter_projects_by_permissions(list(projects), request, include_all_accessible=True)
