from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_SUCCESS,
    RESPONSE_TOO_MANY_REQUESTS,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
from sentry.models.project import Project
from sentry.preprod.api.schemas import SHA_PATTERN
from sentry.preprod.vcs.status_checks.skip import (
    SUPPORTED_STATUS_CHECK_PROVIDERS,
    SkipStatusCheckError,
    StatusCheckType,
    create_skipped_status_check,
)
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import metrics


class SkipStatusCheckSerializer(serializers.Serializer[dict[str, str]]):
    sha = serializers.RegexField(
        regex=SHA_PATTERN,
        max_length=40,
        trim_whitespace=False,
        help_text="The full 40-character lowercase commit SHA.",
    )
    repository = serializers.CharField(
        max_length=255,
        help_text="The repository name in `owner/name` format.",
    )
    provider = serializers.ChoiceField(
        choices=SUPPORTED_STATUS_CHECK_PROVIDERS,
        help_text="The repository integration provider.",
    )


_SKIP_STATUS_CHECK_RESPONSES = {
    200: RESPONSE_SUCCESS,
    400: RESPONSE_BAD_REQUEST,
    403: RESPONSE_FORBIDDEN,
    404: RESPONSE_NOT_FOUND,
    429: RESPONSE_TOO_MANY_REQUESTS,
    502: OpenApiResponse(description="Bad Gateway"),
}


class BaseProjectPreprodSkipStatusCheckEndpoint(ProjectEndpoint):
    """Create a neutral status check for a commit that intentionally skips an artifact upload.

    The repository must have an active GitHub integration in the project's organization.
    The same Sentry auth token configured for build uploads can also be used for this endpoint.
    """

    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    # Release scope: the same token that uploads builds can post skips.
    permission_classes = (ProjectReleasePermission,)
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": {
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60),
            }
        }
    )

    check_type: StatusCheckType

    def post(
        self, request: Request, project: Project
    ) -> Response[None] | Response[DetailResponse] | Response[ValidationErrorResponse]:
        serializer = SkipStatusCheckSerializer(data=request.data)
        if not serializer.is_valid():
            self._record_failure("validation_error")
            return Response(as_validation_errors(serializer), status=400)

        data = serializer.validated_data

        try:
            create_skipped_status_check(
                project=project,
                repo_name=data["repository"],
                provider=data["provider"],
                sha=data["sha"],
                check_type=self.check_type,
            )
        except SkipStatusCheckError as e:
            self._record_failure(e.reason)
            return Response({"detail": e.detail}, status=e.status_code)

        metrics.incr(
            "preprod.status_checks.skip",
            tags={"check_type": self.check_type, "success": True},
        )
        return Response(status=200)

    def _record_failure(self, reason: str) -> None:
        metrics.incr(
            "preprod.status_checks.skip",
            tags={"check_type": self.check_type, "success": False, "reason": reason},
        )


@extend_schema(tags=["Mobile Builds"])
@extend_schema_view(
    post=extend_schema(
        operation_id="createProjectPreprodSizeAnalysisSkippedStatusCheck",
        summary="Create a skipped Size Analysis status check",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=SkipStatusCheckSerializer,
        responses=_SKIP_STATUS_CHECK_RESPONSES,
    )
)
@cell_silo_endpoint
class ProjectPreprodSizeAnalysisSkipStatusCheckEndpoint(BaseProjectPreprodSkipStatusCheckEndpoint):
    check_type = "size"


@extend_schema(tags=["Snapshots"])
@extend_schema_view(
    post=extend_schema(
        operation_id="createProjectPreprodSnapshotSkippedStatusCheck",
        summary="Create a skipped Snapshot status check",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=SkipStatusCheckSerializer,
        responses=_SKIP_STATUS_CHECK_RESPONSES,
    )
)
@cell_silo_endpoint
class ProjectPreprodSnapshotSkipStatusCheckEndpoint(BaseProjectPreprodSkipStatusCheckEndpoint):
    check_type = "snapshots"
