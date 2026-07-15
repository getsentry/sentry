from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import ParseError, PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEventPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.issues.progress import get_group_progress_states
from sentry.issues.progress_state import IssueProgressState
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class GroupProgressQuerySerializer(serializers.Serializer[None]):
    groups = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        min_length=1,
        max_length=100,
    )


@cell_silo_endpoint
class OrganizationGroupIndexProgressEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationEventPermission,)
    enforce_rate_limit = True
    owner = ApiOwner.ISSUES

    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=10, window=1),
                RateLimitCategory.USER: RateLimit(limit=10, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=10, window=1),
            }
        }
    )

    @extend_schema(
        operation_id="Get Progress for a List of Issues",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="groups",
                location="query",
                required=True,
                type=int,
                many=True,
                description="One or more group IDs to retrieve progress for. Maximum 100.",
            ),
        ],
        responses={
            200: dict[str, dict[str, dict[str, str]]],
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:issue-stream-progress-ui", organization, actor=request.user
        ):
            raise ResourceDoesNotExist

        serializer = GroupProgressQuerySerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        group_ids = set(serializer.validated_data["groups"])

        projects = self.get_projects(request, organization)
        project_ids = [p.id for p in projects]

        groups = list(
            Group.objects.filter(id__in=group_ids, project_id__in=project_ids).select_related(
                "project"
            )
        )

        if not groups:
            raise ParseError(detail="No matching groups found")

        if not all(request.access.has_project_access(g.project) for g in groups):
            raise PermissionDenied

        found_group_ids = [g.id for g in groups]

        # This is a multi-project endpoint that supports filtering;
        # only enable if all selected projects have the feature
        unique_projects = {g.project for g in groups}
        if all(
            features.has("projects:issue-stream-derived-progress", project, actor=request.user)
            for project in unique_projects
        ):
            progress_by_group = _get_derived_progress(found_group_ids)
        else:
            progress_by_group = get_group_progress_states(found_group_ids)

        return Response(
            {"results": {str(gid): {"progress": progress_by_group[gid]} for gid in found_group_ids}}
        )


def _get_derived_progress(group_ids: list[int]) -> dict[int, str]:
    """
    Read progress directly from GroupDerivedData.

    GroupDerivedData stores progress=None for closed issues (resolved/archived).
    This endpoint maps None to FIX_APPLIED since closed issues have completed
    their progress lifecycle. Groups without a derived-data row default to
    IDENTIFIED.
    """
    derived_rows = GroupDerivedData.objects.filter(group_id__in=group_ids).values_list(
        "group_id", "progress"
    )

    result: dict[int, str] = {}
    for group_id, progress in derived_rows:
        if progress is None:
            result[group_id] = IssueProgressState.FIX_APPLIED.value
        else:
            result[group_id] = progress

    for group_id in group_ids:
        if group_id not in result:
            result[group_id] = IssueProgressState.IDENTIFIED.value

    return result
