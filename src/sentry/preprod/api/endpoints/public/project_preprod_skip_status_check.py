from __future__ import annotations

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.apidocs.response_types import as_validation_errors
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
    sha = serializers.RegexField(regex=SHA_PATTERN, max_length=40, trim_whitespace=False)
    repository = serializers.CharField(max_length=255)
    provider = serializers.ChoiceField(choices=SUPPORTED_STATUS_CHECK_PROVIDERS)


class BaseProjectPreprodSkipStatusCheckEndpoint(ProjectEndpoint):
    """Post a passing "skipped" status check for a bare commit SHA, so a required
    check is satisfied on PRs that intentionally don't upload an artifact.
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

    def post(self, request: Request, project: Project) -> Response:
        serializer = SkipStatusCheckSerializer(data=request.data)
        if not serializer.is_valid():
            self._record_failure("validation_error")
            return Response(as_validation_errors(serializer), status=400)

        data = serializer.validated_data

        try:
            check_id = create_skipped_status_check(
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
        return Response({"checkId": check_id}, status=200)

    def _record_failure(self, reason: str) -> None:
        metrics.incr(
            "preprod.status_checks.skip",
            tags={"check_type": self.check_type, "success": False, "reason": reason},
        )


@cell_silo_endpoint
class ProjectPreprodSizeAnalysisSkipStatusCheckEndpoint(BaseProjectPreprodSkipStatusCheckEndpoint):
    check_type = "size"


@cell_silo_endpoint
class ProjectPreprodSnapshotSkipStatusCheckEndpoint(BaseProjectPreprodSkipStatusCheckEndpoint):
    check_type = "snapshots"
