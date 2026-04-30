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
from sentry.preprod.api.models.public.size_status_check_rules import (
    ProjectSizeStatusCheckRulesResponseDict,
    create_project_status_check_rules_response,
)
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@extend_schema(tags=["Mobile Builds"])
@cell_silo_endpoint
class ProjectPreprodSizeAnalysisStatusCheckRulesEndpoint(ProjectEndpoint):
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
        operation_id="Retrieve Size Analysis status check rules for a project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ProjectSizeStatusCheckRulesResponse",
                ProjectSizeStatusCheckRulesResponseDict,
            ),
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=PreprodExamples.GET_SIZE_STATUS_CHECK_RULES,
    )
    def get(self, request: Request, project: Project) -> Response:
        """
        Retrieve the current Size Analysis status check rules configured for a project.

        The response includes whether Sentry status check enforcement is enabled and the
        normalized rule list Sentry uses when evaluating Size Analysis thresholds.
        """
        return Response(create_project_status_check_rules_response(project))
