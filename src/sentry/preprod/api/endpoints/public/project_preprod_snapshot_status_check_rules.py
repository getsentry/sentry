from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.preprod_examples import PreprodExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.preprod.api.models.public.snapshot_status_check_rules import (
    ProjectSnapshotStatusCheckRulesResponseDict,
    create_project_snapshot_status_check_rules_response,
)
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@extend_schema(tags=["Snapshots"])
@cell_silo_endpoint
class ProjectPreprodSnapshotStatusCheckRulesEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (ProjectPermission,)
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60),
            }
        }
    )

    @extend_schema(
        operation_id="Retrieve Snapshot status check rules for a project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ProjectSnapshotStatusCheckRulesResponse",
                ProjectSnapshotStatusCheckRulesResponseDict,
            ),
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=PreprodExamples.GET_SNAPSHOT_STATUS_CHECK_RULES,
    )
    def get(
        self, request: Request, project: Project
    ) -> Response[ProjectSnapshotStatusCheckRulesResponseDict]:
        r"""
        Retrieve the current Snapshot status check rules configured for a project.

        Use this endpoint when external CI needs to evaluate the same Snapshot
        change-type rules that Sentry uses. The endpoint returns the current
        project configuration, not a historical snapshot from when a build was
        processed.

        The response includes whether status check enforcement is enabled and the
        Snapshot change types that fail the status check.

        This endpoint requires a bearer token with `project:read` access. Project
        distribution tokens are not supported.

        Response notes:

        - `enabled: false` means status-check enforcement is disabled for the project.
        - `rules` contains one boolean per Snapshot change type.
        - `failOnAdded`, `failOnRemoved`, `failOnChanged`, and `failOnRenamed`
          indicate which unapproved change types fail the status check.
        """
        return Response(create_project_snapshot_status_check_rules_response(project))
