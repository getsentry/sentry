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
        r"""
        Retrieve the current Size Analysis status check rules configured for a project.

        Use this endpoint after receiving a `size_analysis.completed` webhook when you
        want external CI to evaluate the same Size Analysis status check thresholds that
        Sentry uses. The endpoint returns the current project configuration, not a
        historical snapshot from when the webhook was emitted.

        The response includes whether status check enforcement is enabled and the
        normalized rule list Sentry uses when evaluating Size Analysis thresholds.

        This endpoint requires a bearer token with `project:read` access. Project
        distribution tokens are not supported.

        Response notes:

        - `enabled: false` means status-check enforcement is disabled for the project.
        - `rules: []` means there are no configured thresholds to evaluate.
        - `value` is returned as a string. For `absolute` and `absolute_diff`
          measurements it is a byte value; for `relative_diff` it is a percentage.
        - `filterQuery` is the original configured filter string.
        - `filters` is the machine-readable version of `filterQuery`.
        - `filters: []` means the rule has no filters and applies to all builds.
        - `filters: null` means the saved filter query could not be parsed; Sentry's
          status check trigger treats that rule as non-matching.

        Rule evaluation semantics:

        - Threshold comparisons are strict: a rule triggers only when the computed value
          is greater than the configured threshold, not greater than or equal to it.
        - `absolute_diff` and `relative_diff` require a matching base metric/build.
        - `relative_diff` does not trigger when the base size is zero.
        - `artifactType` identifies the artifact scope the rule evaluates.
          `main_artifact`, `watch_artifact`, `android_dynamic_feature_artifact`,
          and `app_clip_artifact` target their matching artifact metric.
          `all_artifacts` evaluates all available artifact metrics.
        - Rule filters support the keys `app_id`, `git_head_ref`,
          `build_configuration_name`, and `platform_name`.
        - Filter objects are combined with AND. Multiple `conditions` inside one
          filter object are combined with OR.
        - Each condition uses `values`; single-value operators still return a
          one-item array.
        - Values in `filters` are decoded literal values for exact/simple operators,
          not query syntax. For example, `app_id:\*com` in `filterQuery` becomes
          `values: ["*com"]` with `operator: "equals"`.
        - The same key can appear in more than one filter object when positive and
          negative conditions both exist; those filter objects are still combined with
          AND.
        - Supported filter operators are `equals`, `notEquals`, `in`, `notIn`,
          `contains`, `notContains`, `startsWith`, `notStartsWith`, `endsWith`,
          `notEndsWith`, `matches`, and `notMatches`.
        - `matches` and `notMatches` values use Sentry wildcard pattern syntax, not
          regular expressions. `*` matches zero or more characters, escaped `\*`
          matches a literal asterisk, and a pattern without `*` is an exact match.
        - `in` and `notIn` are evaluated as one condition against all values, matching
          Sentry's status check trigger behavior.
        - A rule applies only when the build metadata matches all filters. If a
          referenced metadata key is missing, the filter does not match, even for
          negated operators.
        """
        return Response(create_project_status_check_rules_response(project))
